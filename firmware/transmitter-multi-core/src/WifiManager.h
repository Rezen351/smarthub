#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "Settings.h"
#include "SharedState.h"

// Handles the always-on soft-AP (captive portal) plus the uplink STA
// connection that supports both WPA2-PSK and WPA2-Enterprise.
// Also manages W5500 Ethernet when transport mode is set to Ethernet.
class WifiManager {
public:
  // Starts soft AP and (non-blocking) STA connect per saved settings.
  void begin(const AppSettings& s);
  // Call periodically from the network task: reconnect supervision.
  void loop();

  String       apSsid() { return _apSsid; }
  IPAddress    apIP()   { return WiFi.softAPIP(); }
  bool         apActive() const { return WiFi.getMode() & WIFI_AP; }
  bool         staConnected();
  int          savedMode() { return _savedMode; }
  String       savedSsid() { return _savedSsid; }
  int8_t       rssi();
  // Blocking variant: applies the uplink immediately (boot-time / non-HTTP
  // callers). HTTP handlers must use requestSettings() instead.
  void         applySettings(const AppSettings& s);

  // Non-blocking variant used by the HTTP portal: stores the new credentials
  // and applies them from loop() after WIFI_APPLY_DELAY_MS, so the HTTP
  // response reaches the browser before the radio is reconfigured.
  void         requestSettings(const AppSettings& s);
  bool         applyPending() { return _applyPending; }

  uint8_t      transportMode() const { return _transportMode; }
  void         setTransportMode(uint8_t mode);
  bool         ethernetActive() const { return _ethernetActive; }
  IPAddress    ethernetIp() const { return _ethernetIp; }

private:
  uint8_t      _savedMode = WIFI_MODE_NONE;
  String       _savedSsid;
  uint32_t     _lastCheck = 0;
  String       _apSsid;

  bool         _applyPending = false;
  uint32_t     _applyAtMs    = 0;
  AppSettings  _pendingCfg;

  uint8_t      _transportMode = DEFAULT_TRANSPORT;
  bool         _ethernetActive = false;
  IPAddress    _ethernetIp;

  void  startSta(const AppSettings& s);
  void  applyPendingSettings();
  void  beginEthernet(const AppSettings& s);
  void  stopEthernet();
};

#endif // WIFI_MANAGER_H
