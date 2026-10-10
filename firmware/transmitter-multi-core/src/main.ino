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
#if DISPLAY_USE_6932
#include "GN6932Display.h"
#include "ButtonManager.h"
#endif
#include "TaskWatchdog.h"
#include "StateMachine.h"
#include "EventBus.h"
#include "DriverRegistry.h"

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
#if DISPLAY_USE_6932
Gn6932Display g6932(DISPLAY6932_CLK_PIN, DISPLAY6932_DIN_PIN, DISPLAY6932_STB_PIN);
ButtonManager gButtons(&gShared, &gSettings);
#endif
StateMachine gFsm;
EventBus     gEventBus;

AppSettings  gAppSettings;

#if DISPLAY_USE_6932
static bool gDisplayManualTest = false;
static char gDisplaySerialLine[96];
static uint8_t gDisplaySerialLineLength = 0;

static bool parseUnsigned(const char* value, uint32_t* result, int base) {
  if (value == nullptr || result == nullptr || value[0] == '\0') return false;
  char* end = nullptr;
  unsigned long parsed = strtoul(value, &end, base);
  if (*end != '\0' || parsed > UINT32_MAX) return false;
  *result = static_cast<uint32_t>(parsed);
  return true;
}

static void printDisplayTestHelp() {
  Serial.println(F("Display test commands:"));
  Serial.println(F("  help                          Show this help"));
  Serial.println(F("  grid <1-16> <hex>             Raw mask, e.g. grid 1 0xFF"));
  Serial.println(F("  all <hex>                     Same mask on all grids"));
  Serial.println(F("  char <1-16> <symbol>          Calibrated digit/letter"));
  Serial.println(F("  section <1-3> <text>          Render section text with DP"));
  Serial.println(F("  clear                         Turn all grids off"));
  Serial.println(F("  brightness <0-7>              Set display brightness"));
  Serial.println(F("  auto                          Resume live weight/price display"));
  Serial.println(F("Use CRLF or press Enter after each command."));
}

static void handleDisplaySerialCommand(char* line) {
  char* command = strtok(line, " \t");
  if (command == nullptr) return;

  if (strcmp(command, "help") == 0) {
    printDisplayTestHelp();
    return;
  }
  if (strcmp(command, "auto") == 0) {
    gDisplayManualTest = false;
    Serial.println(F("Display test mode OFF; live display resumed."));
    return;
  }
  if (strcmp(command, "clear") == 0) {
    gDisplayManualTest = true;
    g6932.clear();
    Serial.println(F("Display cleared. Test mode ON."));
    return;
  }
  if (strcmp(command, "all") == 0) {
    uint32_t mask = 0;
    if (!parseUnsigned(strtok(nullptr, " \t"), &mask, 0) || mask > 0xFF) {
      Serial.println(F("ERROR: use all <hex 0x00-0xFF>"));
      return;
    }
    gDisplayManualTest = true;
    g6932.showAllMask(static_cast<uint8_t>(mask));
    Serial.printf("OK: all grids mask=0x%02lX; test mode ON\n",
                  static_cast<unsigned long>(mask));
    return;
  }
  if (strcmp(command, "grid") == 0) {
    uint32_t grid = 0;
    uint32_t mask = 0;
    if (!parseUnsigned(strtok(nullptr, " \t"), &grid, 10) ||
        !parseUnsigned(strtok(nullptr, " \t"), &mask, 0) ||
        grid < 1 || grid > GN6932::GRID_COUNT || mask > 0xFF) {
      Serial.println(F("ERROR: use grid <1-16> <hex 0x00-0xFF>"));
      return;
    }
    gDisplayManualTest = true;
    g6932.showGridMask(static_cast<uint8_t>(grid - 1), static_cast<uint8_t>(mask));
    Serial.printf("OK: grid %lu mask=0x%02lX; test mode ON\n",
                  static_cast<unsigned long>(grid),
                  static_cast<unsigned long>(mask));
    return;
  }
  if (strcmp(command, "char") == 0) {
    uint32_t grid = 0;
    char* symbol = strtok(nullptr, " \t");
    if (!parseUnsigned(strtok(nullptr, " \t"), &grid, 10) ||
        symbol == nullptr || symbol[0] == '\0' ||
        grid < 1 || grid > GN6932::GRID_COUNT) {
      Serial.println(F("ERROR: use char <1-16> <symbol>"));
      return;
    }
    gDisplayManualTest = true;
    char value = static_cast<char>(toupper(static_cast<unsigned char>(symbol[0])));
    g6932.showCharacter(static_cast<uint8_t>(grid - 1), value);
    Serial.printf("OK: grid %lu char=%c; test mode ON\n",
                  static_cast<unsigned long>(grid), value);
    return;
  }
  if (strcmp(command, "section") == 0) {
    uint32_t section = 0;
    char* sectionToken = strtok(nullptr, " \t");
    char* text = strtok(nullptr, "");
    if (!parseUnsigned(sectionToken, &section, 10) ||
        text == nullptr || section < 1 || section > 3) {
      Serial.println(F("ERROR: use section <1-3> <text>"));
      return;
    }
    while (*text == ' ' || *text == '\t') ++text;
    if (!g6932.showSection(static_cast<uint8_t>(section), text)) {
      Serial.println(F("ERROR: invalid section text"));
      return;
    }
    gDisplayManualTest = true;
    Serial.printf("OK: section %lu text=%s; test mode ON\n",
                  static_cast<unsigned long>(section), text);
    return;
  }
  if (strcmp(command, "brightness") == 0) {
    uint32_t brightness = 0;
    if (!parseUnsigned(strtok(nullptr, " \t"), &brightness, 10) || brightness > 7) {
      Serial.println(F("ERROR: use brightness <0-7>"));
      return;
    }
    g6932.setBrightness(static_cast<uint8_t>(brightness));
    Serial.printf("OK: brightness=%lu\n", static_cast<unsigned long>(brightness));
    return;
  }

  Serial.println(F("ERROR: unknown command; type help"));
}

static void readDisplaySerialCommands() {
  while (Serial.available() > 0) {
    char received = static_cast<char>(Serial.read());
    if (received == '\r') continue;
    if (received == '\n') {
      gDisplaySerialLine[gDisplaySerialLineLength] = '\0';
      handleDisplaySerialCommand(gDisplaySerialLine);
      gDisplaySerialLineLength = 0;
      continue;
    }
    if (gDisplaySerialLineLength < sizeof(gDisplaySerialLine) - 1) {
      gDisplaySerialLine[gDisplaySerialLineLength++] = received;
    } else {
      gDisplaySerialLineLength = 0;
      Serial.println(F("ERROR: command too long"));
    }
  }
}
#endif

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
  
  for (;;) {
    TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
#if DISPLAY_USE_6932
    readDisplaySerialCommands();
#endif
    gEventBus.process();
    gPortal.handleClient();
    TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
    gWifi.loop();
    TaskWatchdog::feed("net", NET_WATCHDOG_TIMEOUT_MS);
    ArduinoOTA.handle();

    if ((millis() - lastModbus) >= MODBUS_POLL_MS) {
      lastModbus = millis();
      gModbus.setRuntime(gWifi.rssi(), gWifi.savedMode());
      gModbus.loop();
    }

#if !DISPLAY_USE_6932
    gDisplay.loop();
#endif
#if DISPLAY_USE_6932
    if (!gDisplayManualTest && (millis() - lastDisplay) >= 500) {
#else
    if ((millis() - lastDisplay) >= 500) {
#endif
      lastDisplay = millis();
      ScaleSnapshot s = gShared.getSnapshot();
#if DISPLAY_USE_6932
      g6932.showWeight(s.stableWeightG / 1000.0f);
#if KEYPAD_ENABLED
      g6932.showUnitPriceCenti(gButtons.currentUnitPriceCenti());
      g6932.showTotalPriceCenti(gButtons.totalPriceCenti());
#endif
#else
      String ip = gWifi.transportMode() == TRANSPORT_ETHERNET ? gWifi.ethernetIp().toString() : WiFi.localIP().toString();
      if (gAppSettings.oledEnabled) {
        gDisplay.showSimple(ip.c_str(), s.stableWeightG / 1000.0f, gWifi.transportMode());
      }
#endif
    }

#if DISPLAY_USE_6932 && KEYPAD_ENABLED
    gButtons.update();
#endif

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

      LOG_INFO("state",       "weight_raw=%.1f median=%.1f stable=%.1f noise=%.1f isStable=%d cal=%d cmdPending=%d "
                    "ap=%s sta=%s rssi=%d transport=%s uptime=%lus fw=%d.%d",
      s.rawSample, s.medianWeightG, s.stableWeightG, s.noiseG,
      s.stable ? 1 : 0, s.calibrated ? 1 : 0,
                    gShared.commandPending() ? 1 : 0,
                    gWifi.apActive() ? "up" : "down",
                    staInfo,
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

#if DISPLAY_USE_6932
  g6932.begin();
#if KEYPAD_ENABLED
  gButtons.begin();
#endif
  Serial.println(F("GN6932 display test ready; type help for commands."));
#else
  gDisplay.begin();
#endif



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
  LOG_INFO("setup", "transport=%s display=%s",
           gAppSettings.transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
#if DISPLAY_USE_6932
           "6932");
#else
           gAppSettings.oledEnabled ? "oled" : "off");
#endif
}

void loop() {
  // All work happens inside the two pinned tasks above.
  vTaskDelete(nullptr);
}
