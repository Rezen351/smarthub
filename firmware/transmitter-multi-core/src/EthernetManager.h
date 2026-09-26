#ifndef ETHERNET_MANAGER_H
#define ETHERNET_MANAGER_H

#include <Arduino.h>
#include <SPIFFS.h>
#include "Settings.h"

class EthernetManager {
 public:
  EthernetManager();
  ~EthernetManager();

  void begin(const AppSettings& s);
  void loop();

  void setTransportMode(uint8_t mode);
  void requestTransportMode(uint8_t mode);
  void updatePendingEthernetConfig(const AppSettings& s);

  bool active() const { return _active; }
  IPAddress localIp() const { return _ip; }

  void loadEthernetConfigFromJson(AppSettings& s);
  void saveEthernetConfigToJson(const AppSettings& s);

 private:
  void initEthernet(const AppSettings& s);
  void stopEthernet();
  void applyPendingTransportMode();

  AppSettings _pendingCfg;
  uint8_t _transportMode = 0;
  bool _transportPending = false;
  uint8_t _transportPendingMode = 0;

  bool _active = false;
  IPAddress _ip;
  uint32_t _retryAtMs = 0;
};

#endif
