// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (Single Core)
//
//  Single-core ESP32 layout:
//    All tasks run in the main loop() without FreeRTOS task pinning.
//    Scale reading, filtering, calibration, web portal, DNS, and Modbus
//    TCP all execute sequentially in loop().
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

SharedState  gShared;
SettingsStore gSettings;
ScaleSensor  gScale;
WifiManager  gWifi;
ModbusServer gModbus;
WebPortal    gPortal;
DisplayManager gDisplay;

AppSettings  gAppSettings;

static void checkForceApButton() {
  if (FORCE_AP_PIN < 0) return;
  pinMode(FORCE_AP_PIN, INPUT_PULLUP);
  if (digitalRead(FORCE_AP_PIN) == HIGH) return;
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

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[scale] E-Tani Weight Transmitter booting (single core)");
  Serial.printf("[scale] FW %d.%d\n",
                FW_VERSION >> 8, FW_VERSION & 0xFF);

  gSettings.begin();
  gSettings.load(gAppSettings);
  checkForceApButton();

  gShared.begin();

  gScale.begin(&gShared, &gSettings);

  gWifi.begin(gAppSettings);

  gModbus.begin(&gShared, &gSettings);
  gModbus.startServer();

  gPortal.begin(&gShared, &gSettings, &gWifi, &gModbus);
  gPortal.startDns();

  gDisplay.begin();

  Serial.println("[scale] AP: " + gWifi.apSsid() + " @ " + gWifi.apIP().toString());
}

void loop() {
  static uint32_t lastModbus = 0;
  static uint32_t lastDisplay = 0;
  uint32_t now = millis();

  gScale.loop();

  gPortal.handleClient();
  gWifi.loop();

  if ((now - lastModbus) >= MODBUS_POLL_MS) {
    lastModbus = now;
    gModbus.setRuntime(gWifi.rssi(), gWifi.savedMode());
    gModbus.loop();
  }

  gDisplay.loop();

  if ((now - lastDisplay) >= 2000) {
    lastDisplay = now;
    ScaleSnapshot s = gShared.getSnapshot();
    const char* transport = gWifi.transportMode() == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi";
    String ip = gWifi.transportMode() == TRANSPORT_ETHERNET ? gWifi.ethernetIp().toString() : WiFi.localIP().toString();
    if (gAppSettings.oledEnabled) {
      gDisplay.showWeight(s.weightG, s.stableWeightG);
      gDisplay.showStatus(transport, ip.c_str());
    }
  }

  delay(1);
}