#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "Settings.h"
#include "SharedState.h"
#include "EthernetManager.h"
#include "Transport.h"
#include "OfflineBuffer.h"

class WifiManager {
 public:
  WifiManager();
  ~WifiManager();

  void begin(const AppSettings& s);
  void loop();

  String       apSsid() { return _apSsid; }
  IPAddress    apIP()   { return WiFi.softAPIP(); }
  bool         apActive() const { return WiFi.getMode() & WIFI_AP; }
  bool         staConnected();
  int          savedMode() { return _savedMode; }
  String       savedSsid() { return _savedSsid; }
  int8_t       rssi();

  void         applySettings(const AppSettings& s);
  void         requestSettings(const AppSettings& s);
  bool         applyPending() { return _applyPending; }

  uint8_t      transportMode() const { return _transportMode; }
  void         setTransportMode(uint8_t mode);
  bool         ethernetActive() const { return _ethMgr.active(); }
  IPAddress    ethernetIp() const { return _ethMgr.localIp(); }

  void         requestTransportMode(uint8_t mode);
  bool         transportModePending() const { return _transportState == TransportState::Switching; }

  void         updatePendingEthernetConfig(const AppSettings& s);
  void         syncPendingEthernetConfig(const AppSettings& s);

  void         loadEthernetConfigFromJson(AppSettings& s);
  void         saveEthernetConfigToJson(const AppSettings& s);

  OfflineBuffer& offlineBuffer() { return _offline; }
  bool         offlineBufferMounted() const { return _offline.mounted(); }

 private:
  uint8_t      _savedMode = WIFI_MODE_NONE;
  String       _savedSsid;
  uint32_t     _lastCheck = 0;
  String       _apSsid;

  bool         _applyPending = false;
  uint32_t     _applyAtMs    = 0;
  AppSettings  _pendingCfg;

  uint8_t      _transportMode = DEFAULT_TRANSPORT;
  TransportState _transportState = TransportState::WiFi;
  uint8_t      _transportTarget = DEFAULT_TRANSPORT;

  bool         _wifiWasConnected = false;
  uint32_t     _wifiReconnectDelayMs = 5000;
  uint32_t     _wifiLastReconnectMs = 0;
  uint32_t     _offlineBufferLastAppendMs = 0;

  OfflineBuffer _offline;
  EthernetManager _ethMgr;

  void  startSta(const AppSettings& s);
  void  applyPendingSettings();
  void  applyPendingTransportMode();
};

#endif
