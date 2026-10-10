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
#include "Buzzer.h"
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
#if BUZZER_ENABLED
Buzzer gBuzzer;
#endif
// The buzzer is compiled in on every ESP32-S3 build; nullptr keeps
// ButtonManager usable if BUZZER_ENABLED is ever forced to 0.
ButtonManager gButtons(&gShared, &gSettings,
#if BUZZER_ENABLED
                       &gBuzzer
#else
                       nullptr
#endif
                       );
#endif
StateMachine gFsm;
EventBus     gEventBus;

AppSettings  gAppSettings;

#if DISPLAY_USE_6932
enum class HardwareTestMode : uint8_t {
  Normal,
  Display,
  Keypad,
  Buzzer
};

static HardwareTestMode gTestMode = HardwareTestMode::Normal;
static bool     gDisplayTestRunning     = false;
static uint8_t  gDisplayTestStep        = 0;   // 0=clear,1=S1,2=S2,3=S3,4=done
static uint32_t gDisplayTestStepMs      = 0;
static constexpr uint32_t DISPLAY_TEST_STEP_HOLD_MS = 800;
static bool     gLiveDisplayRefreshPending = true;

static bool     gNetInfoPageActive      = false;
static uint8_t  gNetInfoPageStep        = 0;   // 0=mode/status, 1=IP, 2=done
static uint32_t gNetInfoPageStepMs      = 0;

// Digits typed so far in the unit-price entry (the '.' key is not a digit).
static uint8_t entryDigitCount(const char* e) {
  uint8_t count = 0;
  for (uint8_t i = 0; e[i] != '\0'; ++i) {
    if (e[i] != '.') ++count;
  }
  return count;
}

static char gDisplaySerialLine[96];
static uint8_t gDisplaySerialLineLength = 0;

static void leaveHardwareTest() {
  gTestMode = HardwareTestMode::Normal;
  gDisplayTestRunning = false;
  gNetInfoPageActive = false;
  gLiveDisplayRefreshPending = true;
#if KEYPAD_ENABLED
  gButtons.setTestMode(false);
#endif
#if BUZZER_ENABLED
  gBuzzer.stop();
#endif
}

static void handleDisplaySerialCommand(char* line) {
  char* command = strtok(line, " \t");
  if (command == nullptr) return;

  // Manual frame commands: write one grid and hold it instead of the live
  // display, so the operator can map segments, characters, and DPs by hand.
  if (strcmp(command, "grid") == 0 || strcmp(command, "char") == 0) {
    if (gTestMode != HardwareTestMode::Display) {
      Serial.println(F("ERROR: run 'test display' before grid/char commands"));
      return;
    }
    char* gridTok = strtok(nullptr, " \t");
    char* valueTok = strtok(nullptr, " \t");
    if (gridTok == nullptr || valueTok == nullptr) {
      Serial.println(F("ERROR: usage: grid <1-16> <mask> | char <1-16> <symbol|DP>"));
      return;
    }
    char* end = nullptr;
    unsigned long grid = strtoul(gridTok, &end, 0);
    if (end == gridTok || *end != '\0' || grid < 1 || grid > 16) {
      Serial.println(F("ERROR: grid must be 1-16"));
      return;
    }
    if (strcmp(command, "grid") == 0) {
      unsigned long mask = strtoul(valueTok, &end, 0);
      if (end == valueTok || *end != '\0' || mask > 0xFF) {
        Serial.println(F("ERROR: mask must be 0x00-0xFF"));
        return;
      }
      g6932.showGridMask((uint8_t)(grid - 1), (uint8_t)mask);
      Serial.printf("OK: grid %lu = 0x%02lX\n", grid, mask);
    } else if (strcmp(valueTok, "DP") == 0 || strcmp(valueTok, "dp") == 0) {
      g6932.showGridMask((uint8_t)(grid - 1), 0x04);
      Serial.printf("OK: grid %lu = DP\n", grid);
    } else if (strlen(valueTok) == 1) {
      g6932.showCharacter((uint8_t)(grid - 1), valueTok[0]);
      Serial.printf("OK: grid %lu = '%c'\n", grid, valueTok[0]);
    } else {
      Serial.println(F("ERROR: symbol must be a single character or DP"));
      return;
    }
    return;
  }

  if (strcmp(command, "section") == 0) {
    if (gTestMode != HardwareTestMode::Display) {
      Serial.println(F("ERROR: run 'test display' before section commands"));
      return;
    }
    char* sectionTok = strtok(nullptr, " \t");
    if (sectionTok == nullptr) {
      Serial.println(F("ERROR: usage: section <1-3>"));
      return;
    }
    char* end = nullptr;
    unsigned long section = strtoul(sectionTok, &end, 0);
    if (end == sectionTok || *end != '\0' || section < 1 || section > 3) {
      Serial.println(F("ERROR: section must be 1-3"));
      return;
    }
    const char* text = section == 3 ? "888888" : "88888";
    g6932.showSection(static_cast<uint8_t>(section), text);
    Serial.printf("OK: section %lu displayed\n", section);
    return;
  }

  if (strcmp(command, "clear") == 0) {
    if (gTestMode != HardwareTestMode::Display) {
      Serial.println(F("ERROR: run 'test display' before clear"));
      return;
    }
    g6932.clear();
    Serial.println(F("OK: display cleared (live display paused)"));
    return;
  }

  if (strcmp(command, "auto") == 0) {
    leaveHardwareTest();
    Serial.println(F("OK: live display resumed"));
    return;
  }

  if (strcmp(command, "test") == 0) {
    char* sub = strtok(nullptr, " \t");
    if (sub == nullptr) {
      Serial.println(F("UNKNOWN command. Use: test display | test keypad | test buzzer | "
                       "section <1-3> | grid <1-16> <mask> | char <1-16> <symbol|DP> | "
                       "clear | auto | exit"));
      return;
    }
    if (strcmp(sub, "display") == 0) {
      leaveHardwareTest();
      gTestMode = HardwareTestMode::Display;
      gDisplayTestRunning = true;
      gDisplayTestStep    = 0;
      gDisplayTestStepMs  = millis();
      g6932.clear();
      Serial.println(F("OK: display test started (section 1 -> 2 -> 3)"));
      return;
    }
    if (strcmp(sub, "keypad") == 0) {
#if KEYPAD_ENABLED
      leaveHardwareTest();
      gTestMode = HardwareTestMode::Keypad;
      gButtons.setTestMode(true);
      Serial.println(F("OK: keypad test mode ON; normal keypad actions and buzzer clicks are suspended"));
#else
      Serial.println(F("ERROR: keypad not available in this build"));
#endif
      return;
    }
    if (strcmp(sub, "buzzer") == 0) {
#if BUZZER_ENABLED
      leaveHardwareTest();
      gTestMode = HardwareTestMode::Buzzer;
      gBuzzer.play(Buzzer::Pattern::SelfTest);
      Serial.println(F("OK: buzzer self-test started"));
#else
      Serial.println(F("ERROR: buzzer not available in this build"));
#endif
      return;
    }
    Serial.println(F("UNKNOWN command. Use: test display | test keypad | test buzzer | "
                     "section <1-3> | grid <1-16> <mask> | char <1-16> <symbol|DP> | "
                     "clear | auto | exit"));
    return;
  }

  if (strcmp(command, "exit") == 0) {
    leaveHardwareTest();
    Serial.println(F("OK: all tests exited; normal operation resumed"));
    return;
  }

  Serial.println(F("UNKNOWN command. Use: test display | test keypad | test buzzer | "
                   "grid <1-16> <mask> | char <1-16> <symbol|DP> | clear | auto | exit"));
}

static void runDisplayTestTick() {
  if (!gDisplayTestRunning) return;
  uint32_t now = millis();
  if ((now - gDisplayTestStepMs) < DISPLAY_TEST_STEP_HOLD_MS) return;
  gDisplayTestStepMs = now;
  switch (gDisplayTestStep) {
    case 0:  g6932.clear(); break;
    case 1:  g6932.showSection(1, "88888");  break;
    case 2:  g6932.showSection(2, "88888");  break;
    case 3:  g6932.showSection(3, "888888"); break;
    default:
      gDisplayTestRunning = false;
      Serial.println(F("OK: display sequence complete; display test mode remains active"));
      Serial.println(F("Enter section <1-3>, grid, char, or clear; use auto/exit to resume live display"));
      return;
  }
  ++gDisplayTestStep;
}

// M4 network info page: page 1 shows the transport mode and link status,
// page 2 splits the active IP over the three display sections.
static void drawNetInfoPage() {
#if KEYPAD_ENABLED
  bool eth = gWifi.transportMode() == TRANSPORT_ETHERNET;
  bool up = eth ? gWifi.ethernetActive() : gWifi.staConnected();

  if (gNetInfoPageStep == 0) {
    g6932.showSectionText(1, eth ? "ETHER" : "WWIFI");
    g6932.showSectionText(2, up ? "UP" : "DOWN");
    g6932.showSectionText(3, "");
    return;
  }

  IPAddress ip = eth ? gWifi.ethernetIp()
                     : (gWifi.staConnected() ? WiFi.localIP() : WiFi.softAPIP());
  char octet1[8], octet2[8], octet3[16];
  snprintf(octet1, sizeof(octet1), "%u.", (unsigned)ip[0]);
  snprintf(octet2, sizeof(octet2), "%u.", (unsigned)ip[1]);
  snprintf(octet3, sizeof(octet3), "%u.%u", (unsigned)ip[2], (unsigned)ip[3]);
  g6932.showSectionText(1, octet1);
  g6932.showSectionText(2, octet2);
  g6932.showSectionText(3, octet3);
#endif
}

// M4 network info page ticker. The page is the only keypad-driven overlay:
// it starts on the M4 request and steps from the transport mode/link status
// page to the IP page before the live display resumes. A running serial
// display test always takes precedence, and the request flag is consumed on
// every tick so no stale request survives.
static void runNetInfoPageTick() {
#if KEYPAD_ENABLED
  bool netReq = gButtons.consumeNetworkInfoRequest();

  if (gTestMode != HardwareTestMode::Normal) return;

  if (netReq) {
    gNetInfoPageActive = true;
    gNetInfoPageStep = 0;
    gNetInfoPageStepMs = millis();
    drawNetInfoPage();
    return;
  }
  if (!gNetInfoPageActive) return;                          // live display path
  if ((millis() - gNetInfoPageStepMs) >= (gNetInfoPageStep == 0 ? NET_INFO_PAGE1_MS : NET_INFO_PAGE2_MS)) {
    gNetInfoPageStepMs = millis();
    if (++gNetInfoPageStep > 1) {
      gNetInfoPageActive = false;
      gLiveDisplayRefreshPending = true;
      return;
    }
    drawNetInfoPage();
  }
#endif
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

#if BUZZER_ENABLED
    // Error pattern (~500 ms) sounds during the 1 s wait before restart
    gBuzzer.play(Buzzer::Pattern::Error);
#endif

    const esp_partition_t* running = esp_ota_get_running_partition();
    const esp_partition_t* next = esp_ota_get_next_update_partition(NULL);

    if (running != NULL && next != NULL && running != next) {
      esp_ota_set_boot_partition(next);
      prefs.putInt("boot_count", 0);
      LOG_INFO("ota", "rollback initiated, rebooting");
    } else {
      LOG_ERROR("ota", "ERROR: cannot perform rollback - no alternate partition");
    }

    uint32_t rebootWaitMs = millis();
    while ((millis() - rebootWaitMs) < 1000) {
#if BUZZER_ENABLED
      gBuzzer.update();   // keep the error pattern sounding before restart
#endif
      delay(10);
    }
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
#if BUZZER_ENABLED
    gBuzzer.play(Buzzer::Pattern::Error);
#endif
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
    runDisplayTestTick();
    runNetInfoPageTick();
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
    if (gTestMode == HardwareTestMode::Normal && !gNetInfoPageActive &&
        (gLiveDisplayRefreshPending || (millis() - lastDisplay) >= 500)) {
#else
    if ((millis() - lastDisplay) >= 500) {
#endif
      lastDisplay = millis();
      ScaleSnapshot s = gShared.getSnapshot();
#if DISPLAY_USE_6932
      Gn6932Display::DisplayIndicators ind;
      ind.tare = s.tareActive && !s.atZero;
      ind.zero = s.atZero;
      ind.stab = s.stable;
      g6932.setIndicators(ind);
      g6932.showWeight(s.stableWeightG / 1000.0f);
#if KEYPAD_ENABLED
      const char* entry = gButtons.entryText();
      if (entry[0] == '\0') {
        g6932.showSectionText(2, "");                                 // blank until typed/recalled
      } else if (entryDigitCount(entry) <= 5) {
        g6932.showSectionText(2, entry, true);                        // decimals only when '.' was pressed
      } else {
        g6932.showUnitPriceCenti(gButtons.currentUnitPriceCenti());  // fallback: money rule
      }
      g6932.showTotalPriceCenti(gButtons.totalPriceCenti());
#endif
      gLiveDisplayRefreshPending = false;
#else
      String ip = gWifi.transportMode() == TRANSPORT_ETHERNET ? gWifi.ethernetIp().toString() : WiFi.localIP().toString();
      if (gAppSettings.oledEnabled) {
        gDisplay.showSimple(ip.c_str(), s.stableWeightG / 1000.0f, gWifi.transportMode());
      }
#endif
    }

#if DISPLAY_USE_6932 && KEYPAD_ENABLED
    if (gTestMode == HardwareTestMode::Normal ||
        gTestMode == HardwareTestMode::Keypad) {
      gButtons.update();
    }
#endif
#if BUZZER_ENABLED
    gBuzzer.update();
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
#if BUZZER_ENABLED
  // Must be ready before checkBootHealth() so a boot-critical error can
  // beep during the 1 s wait that precedes ESP.restart().
  gBuzzer.begin(BUZZER_PIN);
#endif
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
#if BUZZER_ENABLED
  if (!gWifi.apActive())     gBuzzer.play(Buzzer::Pattern::Error);   // softAP failed to start
  if (gWifi.ethNoHardware()) gBuzzer.play(Buzzer::Pattern::Error);   // W5500 not detected
#endif

  gModbus.begin(&gShared, &gSettings, TRANSPORT_WIFI);
  gModbus.startServer();          // WiFi :502
  if (gAppSettings.transportMode == TRANSPORT_ETHERNET) {
    gModbus.startEthernetServer();  // Ethernet :502
  }

  gPortal.begin(&gShared, &gSettings, &gWifi, &gModbus, &gDisplay);
  gPortal.startDns();
#if BUZZER_ENABLED
  if (!gPortal.fsMounted()) gBuzzer.play(Buzzer::Pattern::Error);    // SPIFFS not mounted
#endif

#if DISPLAY_USE_6932
  g6932.begin();
#if KEYPAD_ENABLED
  gButtons.begin();
#endif
  Serial.println(F("Serial test ready: 'test display', 'test keypad', 'test buzzer', 'exit'"));
#else
  gDisplay.begin();
#endif



  otaSetup();

  DeepSleep::begin();

  gFsm.transition(SystemState::INIT);
  gFsm.onEnter();

  gFsm.transition(SystemState::NORMAL);
  gFsm.onEnter();

#if BUZZER_ENABLED
  // Error patterns requested by the boot checks (softAP / W5500 / SPIFFS)
  // must finish before the startup success beep is requested.
  while (gBuzzer.busy()) {
    gBuzzer.update();
    delay(1);
  }
  gBuzzer.play(Buzzer::Pattern::Startup);   // boot completed successfully
#endif

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
