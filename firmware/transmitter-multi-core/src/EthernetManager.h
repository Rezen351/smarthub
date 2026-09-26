#ifndef ETHERNET_MANAGER_H
#define ETHERNET_MANAGER_H

#include <Arduino.h>
#include <SPIFFS.h>
#include "Settings.h"
#include "Transport.h"

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
  TransportState _transportState = TransportState::WiFi;
  uint8_t _transportTarget = 0;

  bool _active = false;
  IPAddress _ip;
  uint32_t _retryAtMs = 0;

  enum class DhcpState : uint8_t {
    Idle,
    Attempting,
    FallbackStatic,
    LinkWait,
    Complete
  };

  DhcpState _dhcpState = DhcpState::Idle;
  uint8_t _dhcpAttempt = 0;
  uint32_t _dhcpNextMs = 0;
  uint32_t _linkWaitStart = 0;
  uint8_t _ipBytes[4];
  uint8_t _gwBytes[4];
  uint8_t _snBytes[4];
  uint8_t _dnsBytes[4];
};

#endif
