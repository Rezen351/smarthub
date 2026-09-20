// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (HX711 load cell)
//
//  Dual-core ESP32 layout:
//    core 0  -> scale task:   HX711 read + filter + calibration math
//    core 1  -> network task: captive portal + DNS + Modbus TCP
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

// ---- application singletons ----
SharedState  gShared;
SettingsStore gSettings;
ScaleSensor  gScale;
WifiManager  gWifi;
ModbusServer gModbus;
WebPortal    gPortal;

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

// ---- core 1 : networking ----
static void networkTask(void* pvParameters) {
  uint32_t lastModbus = 0;
  for (;;) {
    gPortal.handleClient();
    gWifi.loop();

    if ((millis() - lastModbus) >= MODBUS_POLL_MS) {
      lastModbus = millis();
      gModbus.setRuntime(gWifi.rssi(), gWifi.savedMode());
      gModbus.loop();
    }
    delay(1);
  }
}

// ---- core 0 : sensor ----
static void scaleTask(void* pvParameters) {
  for (;;) {
    gScale.loop();
    delay(5);
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

  gModbus.begin(&gShared, &gSettings);
  gModbus.startServer();

  gPortal.begin(&gShared, &gSettings, &gWifi, &gModbus);
  gPortal.startDns();

  // Pin workload to the two ESP32 cores.
  BaseType_t okNet = xTaskCreatePinnedToCore(networkTask, "net",
                                             TASK_STACK_NETWORK, nullptr, 2,
                                             nullptr, CORE_NETWORK);
  BaseType_t okScale = xTaskCreatePinnedToCore(scaleTask, "scale",
                                               TASK_STACK_SCALE, nullptr, 2,
                                               nullptr, CORE_SCALE);
  Serial.printf("[scale] tasks pinned net=%u scale=%u\n", (unsigned)okNet, (unsigned)okScale);
  Serial.println("[scale] AP: " + gWifi.apSsid() + " @ " + gWifi.apIP().toString());
}

void loop() {
  // All work happens inside the two pinned tasks above.
  vTaskDelete(nullptr);
}