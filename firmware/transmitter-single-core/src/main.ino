// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (Single Core)
//
//  Single-core ESP32 layout:
//    All tasks run in the main loop() without FreeRTOS task pinning.
//    Scale reading, filtering, calibration, web portal, DNS, and Modbus
//    TCP all execute sequentially in loop().
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
#include "StateMachine.h"
#include "EventBus.h"
#include "DriverRegistry.h"
#include "MqttClient.h"

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

static void checkForceApButton() {
  if (FORCE_AP_PIN < 0) return;
  pinMode(FORCE_AP_PIN, INPUT_PULLUP);
  if (digitalRead(FORCE_AP_PIN) == HIGH) return;
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

void setup() {
  Logger::begin();
  LOG_INFO("setup", "E-Tani Weight Transmitter booting (single core)");

  gFsm.transition(SystemState::BOOT);
  gFsm.onEnter();

  gSettings.begin();
  gSettings.load(gAppSettings);
  gSettings.validate(gAppSettings);
  checkForceApButton();

  gShared.begin();

  gEventBus.begin(EVENT_BUS_QUEUE_SIZE);
  gEventBus.post(Event{EventType::SYSTEM_BOOT, EventPriority::PRIO_HIGH, millis(), 0});

  gScale.begin(&gShared, &gSettings);

  gWifi.begin(gAppSettings);

  gModbus.begin(&gShared, &gSettings);
  gModbus.startServer();

  gPortal.begin(&gShared, &gSettings, &gWifi, &gModbus);
  gPortal.startDns();

  gDisplay.begin();

  if (strlen(MQTT_SERVER) > 0 && gAppSettings.transportMode == TRANSPORT_WIFI) {
    gMqtt.begin(MQTT_SERVER, MQTT_PORT, MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
    gMqtt.setWill("smartfarm/status/enyx-weight-transmitter", "offline");
  }

  gFsm.transition(SystemState::INIT);
  gFsm.onEnter();

  gFsm.transition(SystemState::NORMAL);
  gFsm.onEnter();

  LOG_INFO("scale", "AP: %s @ %s", gWifi.apSsid().c_str(), gWifi.apIP().toString().c_str());
  LOG_INFO("setup", "transport=%s oled=%s",
            gAppSettings.transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
            gAppSettings.oledEnabled ? "on" : "off");
}

void loop() {
  static uint32_t lastModbus = 0;
  static uint32_t lastDisplay = 0;
  static uint32_t lastStateLog = 0;
  static uint32_t lastMqttPublish = 0;
  uint32_t now = millis();

  gEventBus.process();
  gScale.loop();

  gPortal.handleClient();
  gWifi.loop();

  gMqtt.loop();

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

  if ((now - lastStateLog) >= 5000) {
    lastStateLog = now;
    ScaleSnapshot s = gShared.getSnapshot();
    LOG_INFO("state", "weight_raw=%.1f stable=%.1f cal=%d cmdPending=%d "
                  "ap=%s sta=%s rssi=%d transport=%s uptime=%lus fw=%d.%d",
                  s.rawSample, s.stableWeightG, s.calibrated ? 1 : 0,
                  gShared.commandPending() ? 1 : 0,
                  gWifi.apActive() ? "up" : "down",
                  gWifi.staConnected() ? "connected" : "disconnected",
                  (int)gWifi.rssi(),
                  gWifi.transportMode() == TRANSPORT_ETHERNET ? "eth" : "wifi",
                  (unsigned long)(millis() / 1000),
                  FW_VERSION >> 8, FW_VERSION & 0xFF);
  }

  if ((now - lastMqttPublish) >= MQTT_TELEMETRY_INTERVAL_MS) {
    lastMqttPublish = now;
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

  yield();
}
