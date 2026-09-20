#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "Settings.h"
#include "SharedState.h"

class WifiManager {
public:
  void begin(const AppSettings& s);
  void loop();

  String       apSsid() { return _apSsid; }
  IPAddress    apIP()   { return WiFi.softAPIP(); }
  bool         staConnected();
  int          savedMode() { return _savedMode; }
  String       savedSsid() { return _savedSsid; }
  int8_t       rssi();
  void         applySettings(const AppSettings& s);
  void         requestSettings(const AppSettings& s);
  bool         applyPending() { return _applyPending; }

private:
  uint8_t      _savedMode = WIFI_MODE_NONE;
  String       _savedSsid;
  uint32_t     _lastCheck = 0;
  String       _apSsid;

  bool         _applyPending = false;
  uint32_t     _applyAtMs    = 0;
  AppSettings  _pendingCfg;

  void  startSta(const AppSettings& s);
  void  applyPendingSettings();
};

#endif // WIFI_MANAGER_H