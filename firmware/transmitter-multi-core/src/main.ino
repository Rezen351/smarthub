// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (HX711 load cell)
//
//  Dual-core ESP32-S3 layout:
//    core 0  -> scale task:   HX711 read + filter + calibration math
//    core 1  -> network task: captive portal + DNS + Modbus TCP + OLED updates
//  Data crosses cores only through the mutex-guarded SharedState.
// =====================================================================

#include <Arduino.h>
#include "Logger.h"
#include "config.h"
#include "DeepSleep.h"
#include "SharedState.h"
#include "Settings.h"
#include "Scale.h"
#include "WifiManager.h"
#include "ModbusServer.h"
#include "WebPortal.h"
#include "Display.h"
#include "TaskWatchdog.h"
#include "StateMachine.h"
#include "EventBus.h"
#include "DriverRegistry.h"
#include "MqttClient.h"
#include <ArduinoOTA.h>
#include <Preferences.h>
#include "esp_ota_ops.h"
#include "esp_partition.h"

// ---- application singletons ----
SharedState  gShared;
SettingsStore gSettings;
ScaleSensor  gScale;
WifiManager  gWifi;
ModbusServer gModbus;
WebPortal    gPortal;
DisplayManager gDisplay;
StateMachine gFsm;
EventBus     gEventBus;
MqttClient   gMqtt;

AppSettings  gAppSettings;

// ---- optional boot button: hold to clear WiFi and stay in setup AP ----
static void checkForceApButton() {
  if (FORCE_AP_PIN < 0) return;
  pinMode(FORCE_AP_PIN, INPUT_PULLUP);
  if (digitalRead(FORCE_AP_PIN) == HIGH) return;      // not pressed
  uint32_t t0 = millis();
  while (digitalRead(FORCE_AP_PIN) == LOW && (millis() - t0) < FORCE_AP_HOLD_MS) {
    delay(10);
  }
  if ((millis() - t0) >= FORCE_AP_HOLD_MS) {
    LOG_INFO("setup", "Boot button held -> clearing WiFi credentials");
    AppSettings r; gSettings.load(r);
    r.wifiMode = WIFI_MODE_NONE;
    r.ssid = ""; r.wpaPassword = ""; r.entIdentity = ""; r.entUsername = ""; r.entPassword = "";
    gSettings.saveWifi(r);
  }
}

static void checkBootHealth() {
  Preferences prefs;
  prefs.begin("ota", false);

  int bootCount = prefs.getInt("boot_count", 0);
  bootCount++;
  prefs.putInt("boot_count", bootCount);

  LOG_INFO("ota", "boot_count=%d", bootCount);

  if (bootCount <= 2) {
    prefs.putInt("boot_count", 0);
    bool isHealthy = prefs.getBool("healthy", false);
    if (!isHealthy) {
      prefs.putBool("healthy", true);
      LOG_INFO("ota", "boot health: OK");
    }
  } else if (bootCount > 3) {
    LOG_ERROR("ota", "CRITICAL: boot failure detected multiple times, attempting rollback");

    const esp_partition_t* running = esp_ota_get_running_partition();
    const esp_partition_t* next = esp_ota_get_next_update_partition(NULL);

    if (running != NULL && next != NULL && running != next) {
      esp_ota_set_boot_partition(next);
      prefs.putInt("boot_count", 0);
      LOG_INFO("ota", "rollback initiated, rebooting");
    } else {
      LOG_ERROR("ota", "ERROR: cannot perform rollback - no alternate partition");
    }

    delay(1000);
    ESP.restart();
  }

  prefs.end();
}

static String otaHostname() {
  if (OTA_HOSTNAME && OTA_HOSTNAME[0] != '\0') return String(OTA_HOSTNAME);
  uint64_t mac = ESP.getEfuseMac();
  char suffix[13];
  snprintf(suffix, sizeof(suffix), "%02X%02X%02X%02X%02X%02X",
           (uint8_t)(mac >> 40), (uint8_t)(mac >> 32), (uint8_t)(mac >> 24),
           (uint8_t)(mac >> 16), (uint8_t)(mac >> 8), (uint8_t)mac);
  return String(AP_SSID_PREFIX) + String(suffix);
}

static void otaSetup() {
  ArduinoOTA.setHostname(otaHostname().c_str());
  if (OTA_PASSWORD && OTA_PASSWORD[0] != '\0') {
    ArduinoOTA.setPassword(OTA_PASSWORD);
  }

  ArduinoOTA.onStart([]() {
    LOG_INFO("ota", "update start");
  });
  ArduinoOTA.onEnd([]() {
    LOG_INFO("ota", "update end, restarting");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    unsigned int pct = (progress * 100) / total;
    LOG_INFO("ota", "progress=%u%% (%u/%u bytes)", pct, progress, total);
  });
  ArduinoOTA.onError([](ota_error_t error) {
    LOG_ERROR("ota", "error=%d", (int)error);
  });

  ArduinoOTA.begin();
  LOG_INFO("ota", "hostname=%s port=%u",
            ArduinoOTA.getHostname(), (unsigned)OTA_PORT);
}

// ---- core 1 : networking ----
static void networkTask(void* pvParameters) {
  TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
  uint32_t lastModbus = 0;
  uint32_t lastDisplay = 0;
  uint32_t lastStateLog = 0;
  uint32_t lastMqttPublish = 0;
  for (;;) {
    TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
    gEventBus.process();
    gPortal.handleClient();
    TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
    gWifi.loop();
    TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
    ArduinoOTA.handle();

    gMqtt.loop();

    if ((millis() - lastModbus) >= MODBUS_POLL_MS) {
      lastModbus = millis();
      gModbus.setRuntime(gWifi.rssi(), gWifi.savedMode());
      gModbus.loop();
    }

    gDisplay.loop();
    if ((millis() - lastDisplay) >= 2000) {
      lastDisplay = millis();
      ScaleSnapshot s = gShared.getSnapshot();
      String ip = gWifi.transportMode() == TRANSPORT_ETHERNET ? gWifi.ethernetIp().toString() : WiFi.localIP().toString();
      if (gAppSettings.oledEnabled) {
        gDisplay.showSimple(ip.c_str(), s.stableWeightG / 1000.0f, gWifi.transportMode());
      }
    }

    if ((millis() - lastStateLog) >= 5000) {
      lastStateLog = millis();
      ScaleSnapshot s = gShared.getSnapshot();

      char staInfo[64];
      if (gWifi.transportMode() == TRANSPORT_ETHERNET) {
        if (gWifi.ethernetActive()) {
          snprintf(staInfo, sizeof(staInfo), "disconnected (eth %s)",
                   gWifi.ethernetIp().toString().c_str());
        } else {
          snprintf(staInfo, sizeof(staInfo), "disconnected (eth down)");
        }
      } else {
        if (gWifi.staConnected()) {
          snprintf(staInfo, sizeof(staInfo), "connected (wifi %s)",
                   WiFi.localIP().toString().c_str());
        } else {
          snprintf(staInfo, sizeof(staInfo), "disconnected");
        }
      }

      LOG_INFO("state", "weight_raw=%.1f stable=%.1f cal=%d cmdPending=%d "
                    "ap=%s sta=%s rssi=%d transport=%s uptime=%lus fw=%d.%d",
                    s.rawSample, s.stableWeightG, s.calibrated ? 1 : 0,
                    gShared.commandPending() ? 1 : 0,
                    gWifi.apActive() ? "up" : "down",
                    staInfo,
                    (int)gWifi.rssi(),
                    gWifi.transportMode() == TRANSPORT_ETHERNET ? "eth" : "wifi",
                    (unsigned long)(millis() / 1000),
                    FW_VERSION >> 8, FW_VERSION & 0xFF);
    }

    if ((millis() - lastMqttPublish) >= MQTT_TELEMETRY_INTERVAL_MS) {
      lastMqttPublish = millis();
      if (gMqtt.connected()) {
        ScaleSnapshot s = gShared.getSnapshot();
        char payload[128];
        snprintf(payload, sizeof(payload),
                 "{\"weightG\":%.1f,\"stableG\":%.1f,\"calibrated\":%d,\"uptime\":%lu}",
                 s.weightG, s.stableWeightG, s.calibrated ? 1 : 0,
                 (unsigned long)(millis() / 1000));
        char topic[64];
        snprintf(topic, sizeof(topic), "%s/telemetry", MQTT_TOPIC_PREFIX);
        gMqtt.publish(topic, payload);
      }
    }

    vTaskDelay(1);
  }
}

// ---- core 0 : sensor ----
static void scaleTask(void* pvParameters) {
  TaskWatchdog::feed("scale", 5000);
  for (;;) {
    TaskWatchdog::feed("scale", 5000);
    gScale.loop();
    DeepSleep::maybeSleep();
    vTaskDelay(5);
  }
}

void setup() {
  Logger::begin();
  LOG_INFO("setup", "E-Tani Weight Transmitter booting");

  gFsm.transition(SystemState::BOOT);
  gFsm.onEnter();

  checkBootHealth();

  TaskWatchdog::init();

  LOG_INFO("scale", "FW %d.%d  chipCores=%u",
            FW_VERSION >> 8, FW_VERSION & 0xFF, (unsigned)ESP.getChipCores());

  gSettings.begin();              // create the cross-core NVS mutex first
  gSettings.load(gAppSettings);
  gSettings.validate(gAppSettings);
  checkForceApButton();           // may erase WiFi creds, never calibration

  gShared.begin();

  gEventBus.begin(EVENT_BUS_QUEUE_SIZE);
  gEventBus.post(Event{EventType::SYSTEM_BOOT, EventPriority::PRIO_HIGH, millis(), 0});

  gScale.begin(&gShared, &gSettings);

  gWifi.begin(gAppSettings);      // soft-AP (captive portal) + uplink STA

  gModbus.begin(&gShared, &gSettings, TRANSPORT_WIFI);
  gModbus.startServer();          // WiFi :502
  if (gAppSettings.transportMode == TRANSPORT_ETHERNET) {
    gModbus.startEthernetServer();  // Ethernet :502
  }

  gPortal.begin(&gShared, &gSettings, &gWifi, &gModbus, &gDisplay);
  gPortal.startDns();

  gDisplay.begin();

  if (strlen(MQTT_SERVER) > 0 && gAppSettings.transportMode == TRANSPORT_WIFI) {
    gMqtt.begin(MQTT_SERVER, MQTT_PORT, MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
    gMqtt.setWill("smartfarm/status/enyx-weight-transmitter", "offline");
  }

  otaSetup();

  DeepSleep::begin();

  gFsm.transition(SystemState::INIT);
  gFsm.onEnter();

  gFsm.transition(SystemState::NORMAL);
  gFsm.onEnter();

  // Pin workload to the two ESP32 cores.
  BaseType_t okNet = xTaskCreatePinnedToCore(networkTask, "net",
                                             TASK_STACK_NETWORK, nullptr, 2,
                                             nullptr, CORE_NETWORK);
  BaseType_t okScale = xTaskCreatePinnedToCore(scaleTask, "scale",
                                               TASK_STACK_SCALE, nullptr, 2,
                                               nullptr, CORE_SCALE);
  TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
  TaskWatchdog::feed("scale", 5000);
  LOG_INFO("scale", "tasks pinned net=%u scale=%u", (unsigned)okNet, (unsigned)okScale);
  {
    String apIp = gWifi.apIP().toString();
    LOG_INFO("scale", "AP: %s @ %s", gWifi.apSsid().c_str(), apIp.c_str());
  }
  LOG_INFO("setup", "transport=%s oled=%s",
            gAppSettings.transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
            gAppSettings.oledEnabled ? "on" : "off");
}

void loop() {
  // All work happens inside the two pinned tasks above.
  vTaskDelete(nullptr);
}
