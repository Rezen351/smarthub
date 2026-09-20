#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "Settings.h"
#include "SharedState.h"

// Handles the always-on soft-AP (captive portal) plus the uplink STA
// connection that supports both WPA2-PSK and WPA2-Enterprise.
class WifiManager {
public:
  // Starts soft AP and (non-blocking) STA connect per saved settings.
  void begin(const AppSettings& s);
  // Call periodically from the network task: reconnect supervision.
  void loop();

  String       apSsid() { return _apSsid; }
  IPAddress    apIP()   { return WiFi.softAPIP(); }
  bool         staConnected();
  int          savedMode() { return _savedMode; }
  String       savedSsid() { return _savedSsid; }
  int8_t       rssi();
  void         applySettings(const AppSettings& s);  // re-apply uplink

private:
  uint8_t      _savedMode = WIFI_MODE_NONE;
  String       _savedSsid;
  uint32_t     _lastCheck = 0;
  String       _apSsid;

  void  startSta(const AppSettings& s);
};

#endif // WIFI_MANAGER_H