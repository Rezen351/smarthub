// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (HX711 load cell)
//
//  Dual-core ESP32-S3 layout:
//    core 0  -> scale task:   HX711 read + filter + calibration math
//    core 1  -> network task: captive portal + DNS + Modbus TCP + OLED updates
//  Data crosses cores only through the mutex-guarded SharedState.
// =====================================================================

#include <Arduino.h>
#include "config.h"
#include "SharedState.h"
#include "Settings.h"
#include "Scale.h"
#include "WifiManager.h"
#include "ModbusServer.h"
#include "WebPortal.h"
#include "Display.h"
#include <ArduinoOTA.h>

// ---- application singletons ----
SharedState  gShared;
SettingsStore gSettings;
ScaleSensor  gScale;
WifiManager  gWifi;
ModbusServer gModbus;
WebPortal    gPortal;
DisplayManager gDisplay;

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
    Serial.println("[setup] Boot button held -> clearing WiFi credentials");
    AppSettings r; gSettings.load(r);
    r.wifiMode = WIFI_MODE_NONE;
    r.ssid = ""; r.wpaPassword = ""; r.entIdentity = ""; r.entUsername = ""; r.entPassword = "";
    gSettings.saveWifi(r);
  }
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
    Serial.println("[ota] update start");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\n[ota] update end, restarting");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    unsigned int pct = (progress * 100) / total;
    Serial.printf("[ota] progress=%u%% (%u/%u bytes)\n", pct, progress, total);
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[ota] error=%d\n", (int)error);
  });

  ArduinoOTA.begin();
  Serial.printf("[ota] hostname=%s port=%u\n",
                ArduinoOTA.getHostname(), (unsigned)OTA_PORT);
}

// ---- core 1 : networking ----
static void networkTask(void* pvParameters) {
  uint32_t lastModbus = 0;
  uint32_t lastDisplay = 0;
  uint32_t lastStateLog = 0;
  for (;;) {
    gPortal.handleClient();
    gWifi.loop();
    ArduinoOTA.handle();

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
        gDisplay.showSummary(s.weightG, ip.c_str());
      }
    }

    if ((millis() - lastStateLog) >= 5000) {
      lastStateLog = millis();
      ScaleSnapshot s = gShared.getSnapshot();
      Serial.printf("[state] weight_raw=%.1f stable=%.1f cal=%d cmdPending=%d "
                    "ap=%s sta=%s rssi=%d transport=%s uptime=%lus fw=%d.%d\n",
                    s.rawSample, s.stableWeightG, s.calibrated ? 1 : 0,
                    gShared.commandPending() ? 1 : 0,
                    gWifi.apActive() ? "up" : "down",
                    gWifi.staConnected() ? "connected" : "disconnected",
                    (int)gWifi.rssi(),
                    gWifi.transportMode() == TRANSPORT_ETHERNET ? "eth" : "wifi",
                    (unsigned long)(millis() / 1000),
                    FW_VERSION >> 8, FW_VERSION & 0xFF);
    }

    vTaskDelay(1);
  }
}

// ---- core 0 : sensor ----
static void scaleTask(void* pvParameters) {
  for (;;) {
    gScale.loop();
    vTaskDelay(5);
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[scale] E-Tani Weight Transmitter booting");
  Serial.printf("[scale] FW %d.%d  chipCores=%u\n",
                FW_VERSION >> 8, FW_VERSION & 0xFF, (unsigned)ESP.getChipCores());

  gSettings.begin();              // create the cross-core NVS mutex first
  gSettings.load(gAppSettings);
  checkForceApButton();           // may erase WiFi creds, never calibration

  gShared.begin();

  gScale.begin(&gShared, &gSettings);

  gWifi.begin(gAppSettings);      // soft-AP (captive portal) + uplink STA

  gModbus.begin(&gShared, &gSettings, gAppSettings.transportMode);
  gModbus.startServer();

  gPortal.begin(&gShared, &gSettings, &gWifi, &gModbus, &gDisplay);
  gPortal.startDns();

  gDisplay.begin();

  otaSetup();

  // Pin workload to the two ESP32 cores.
  BaseType_t okNet = xTaskCreatePinnedToCore(networkTask, "net",
                                             TASK_STACK_NETWORK, nullptr, 2,
                                             nullptr, CORE_NETWORK);
  BaseType_t okScale = xTaskCreatePinnedToCore(scaleTask, "scale",
                                                TASK_STACK_SCALE, nullptr, 2,
                                                nullptr, CORE_SCALE);
  Serial.printf("[scale] tasks pinned net=%u scale=%u\n", (unsigned)okNet, (unsigned)okScale);
  Serial.println("[scale] AP: " + gWifi.apSsid() + " @ " + gWifi.apIP().toString());
  Serial.printf("[setup] transport=%s oled=%s\n",
                gAppSettings.transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
                gAppSettings.oledEnabled ? "on" : "off");
}

void loop() {
  // All work happens inside the two pinned tasks above.
  vTaskDelete(nullptr);
}
