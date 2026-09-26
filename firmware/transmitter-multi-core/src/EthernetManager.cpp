#include "EthernetManager.h"
#include "config.h"
#include "Logger.h"
#include "TaskWatchdog.h"
#include <Ethernet.h>
#include <WiFi.h>
#include <SPI.h>
#include <SPIFFS.h>

static uint8_t mac[6];

EthernetManager::EthernetManager() {}

EthernetManager::~EthernetManager() {
  stopEthernet();
}

void EthernetManager::begin(const AppSettings& s) {
  _transportMode = s.transportMode;
  _pendingCfg.transportMode = s.transportMode;
  _pendingCfg.w5500UseDhcp = s.w5500UseDhcp;
  _pendingCfg.w5500StaticIp = s.w5500StaticIp;
  _pendingCfg.w5500StaticGateway = s.w5500StaticGateway;
  _pendingCfg.w5500StaticSubnet = s.w5500StaticSubnet;
  _pendingCfg.w5500StaticDns = s.w5500StaticDns;

  loadEthernetConfigFromJson(_pendingCfg);

  uint64_t efuseMac = ESP.getEfuseMac();
  mac[0] = (efuseMac >> 40) & 0xFF;
  mac[1] = (efuseMac >> 32) & 0xFF;
  mac[2] = (efuseMac >> 24) & 0xFF;
  mac[3] = (efuseMac >> 16) & 0xFF;
  mac[4] = (efuseMac >> 8)  & 0xFF;
  mac[5] =  efuseMac        & 0xFF;

  LOG_INFO("[eth] initialized (transport=%s, dhcp=%u, ip=%s)",
            _transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
            (unsigned)_pendingCfg.w5500UseDhcp,
            _pendingCfg.w5500StaticIp.c_str());
}

void EthernetManager::loop() {
  uint32_t now = millis();

  if (_transportState == TransportState::Switching) {
    applyPendingTransportMode();
    now = millis();
  }

  if (_transportState == TransportState::Ethernet) {
    if (!_active) {
      if (_retryAtMs == 0 || (int32_t)(now - _retryAtMs) >= 0) {
        LOG_INFO("[eth] state=ethernet (starting W5500)");
        initEthernet(_pendingCfg);
        _retryAtMs = millis() + 5000;
      } else {
        LOG_INFO("[eth] state=ethernet (retry in %u ms)",
                      (unsigned)(_retryAtMs - now));
      }
    }
    return;
  }

  if (_active) {
    stopEthernet();
  }
}

void EthernetManager::setTransportMode(uint8_t mode) {
  _transportMode = mode;
  _pendingCfg.transportMode = mode;
  _transportState = mode == TRANSPORT_WIFI ? TransportState::WiFi : TransportState::Ethernet;

  if (mode == TRANSPORT_ETHERNET) {
    WiFi.disconnect(false);
    LOG_INFO("[eth] state=transport-wifi->ethernet");
    initEthernet(_pendingCfg);
  } else {
    LOG_INFO("[eth] state=transport-ethernet->wifi");
    stopEthernet();
  }

  LOG_INFO("[eth] transport mode -> %s",
            mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void EthernetManager::requestTransportMode(uint8_t mode) {
  _transportState = TransportState::Switching;
  _transportTarget = mode;
  LOG_INFO("[eth] transport mode change requested: %s (will apply from loop)",
            mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void EthernetManager::updatePendingEthernetConfig(const AppSettings& s) {
  _pendingCfg.w5500UseDhcp = s.w5500UseDhcp;
  _pendingCfg.w5500StaticIp = s.w5500StaticIp;
  _pendingCfg.w5500StaticGateway = s.w5500StaticGateway;
  _pendingCfg.w5500StaticSubnet = s.w5500StaticSubnet;
  _pendingCfg.w5500StaticDns = s.w5500StaticDns;
  _retryAtMs = 0;
  LOG_INFO("[eth] pending ethernet config updated: dhcp=%u ip=%s",
            (unsigned)s.w5500UseDhcp, s.w5500StaticIp.c_str());
}

void EthernetManager::applyPendingTransportMode() {
  if (_transportState != TransportState::Switching) return;

  uint8_t mode = _transportTarget;
  _transportMode = mode;
  _pendingCfg.transportMode = mode;
  _transportState = mode == TRANSPORT_WIFI ? TransportState::WiFi : TransportState::Ethernet;
  _retryAtMs = 0;

  if (mode == TRANSPORT_ETHERNET) {
    WiFi.disconnect(false);
    LOG_INFO("[eth] state=transport-wifi->ethernet");
    initEthernet(_pendingCfg);
  } else {
    LOG_INFO("[eth] state=transport-ethernet->wifi");
    stopEthernet();
  }

  LOG_INFO("[eth] transport mode -> %s",
            mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void EthernetManager::initEthernet(const AppSettings& s) {
  if (_active) {
    LOG_INFO("[eth] state=already-active");
    return;
  }

  if (_dhcpState == DhcpState::Idle) {
    LOG_INFO("[eth] state=initializing W5500");
    SPI.begin(W5500_SCK_PIN, W5500_MISO_PIN, W5500_MOSI_PIN, W5500_CS_PIN);
    Ethernet.init(W5500_CS_PIN);

    memset(_ipBytes, 0, sizeof(_ipBytes));
    memset(_gwBytes, 0, sizeof(_gwBytes));
    memset(_snBytes, 0, sizeof(_snBytes));
    memset(_dnsBytes, 0, sizeof(_dnsBytes));
    sscanf(s.w5500StaticIp.c_str(), "%hhu.%hhu.%hhu.%hhu", &_ipBytes[0], &_ipBytes[1], &_ipBytes[2], &_ipBytes[3]);
    sscanf(s.w5500StaticGateway.c_str(), "%hhu.%hhu.%hhu.%hhu", &_gwBytes[0], &_gwBytes[1], &_gwBytes[2], &_gwBytes[3]);
    sscanf(s.w5500StaticSubnet.c_str(), "%hhu.%hhu.%hhu.%hhu", &_snBytes[0], &_snBytes[1], &_snBytes[2], &_snBytes[3]);
    sscanf(s.w5500StaticDns.c_str(), "%hhu.%hhu.%hhu.%hhu", &_dnsBytes[0], &_dnsBytes[1], &_dnsBytes[2], &_dnsBytes[3]);

    if (s.w5500UseDhcp) {
      _dhcpState = DhcpState::Attempting;
      _dhcpAttempt = 0;
      _dhcpNextMs = millis();
      LOG_INFO("[eth] state=dhcp-request");
    } else {
      LOG_INFO("[eth] state=static-ip ip=%s gw=%s sn=%s dns=%s",
                    s.w5500StaticIp.c_str(), s.w5500StaticGateway.c_str(),
                    s.w5500StaticSubnet.c_str(), s.w5500StaticDns.c_str());
      Ethernet.begin(mac, IPAddress(_ipBytes[0], _ipBytes[1], _ipBytes[2], _ipBytes[3]),
                     IPAddress(_gwBytes[0], _gwBytes[1], _gwBytes[2], _gwBytes[3]),
                     IPAddress(_snBytes[0], _snBytes[1], _snBytes[2], _snBytes[3]),
                     IPAddress(_dnsBytes[0], _dnsBytes[1], _dnsBytes[2], _dnsBytes[3]));
      _dhcpState = DhcpState::LinkWait;
      _linkWaitStart = millis();
    }
    return;
  }

  if (_dhcpState == DhcpState::Attempting) {
    if ((int32_t)(millis() - _dhcpNextMs) < 0) {
      return;
    }
    TaskWatchdog::feed("net", 5000);
    if (Ethernet.begin(mac) != 0) {
      _dhcpState = DhcpState::LinkWait;
      _linkWaitStart = millis();
      return;
    }
    _dhcpAttempt++;
    if (_dhcpAttempt >= 6) {
      LOG_INFO("[eth] state=dhcp-timeout, fallback to static");
      Ethernet.begin(mac, IPAddress(_ipBytes[0], _ipBytes[1], _ipBytes[2], _ipBytes[3]),
                     IPAddress(_gwBytes[0], _gwBytes[1], _gwBytes[2], _gwBytes[3]),
                     IPAddress(_snBytes[0], _snBytes[1], _snBytes[2], _snBytes[3]),
                     IPAddress(_dnsBytes[0], _dnsBytes[1], _dnsBytes[2], _dnsBytes[3]));
      _dhcpState = DhcpState::LinkWait;
      _linkWaitStart = millis();
      return;
    }
    uint32_t backoff = 500;
    if (_dhcpAttempt >= 2) backoff = 1000;
    if (_dhcpAttempt >= 3) backoff = 2000;
    if (_dhcpAttempt >= 4) backoff = 4000;
    if (_dhcpAttempt >= 5) backoff = 8000;
    _dhcpNextMs = millis() + backoff;
    return;
  }

  if (_dhcpState == DhcpState::LinkWait) {
    TaskWatchdog::feed("net", 5000);
    if ((millis() - _linkWaitStart) < 1000) {
      return;
    }
    _dhcpState = DhcpState::Idle;
    _ip = Ethernet.localIP();
    _active = true;
    LOG_INFO("[eth] state=active ip=%s", _ip.toString().c_str());
    return;
  }
}

void EthernetManager::stopEthernet() {
  if (!_active) {
    LOG_INFO("[eth] state=already-stopped");
    return;
  }

  Ethernet.end();
  _active = false;
  _ip = IPAddress(0, 0, 0, 0);
  _retryAtMs = 0;
  _dhcpState = DhcpState::Idle;
  _dhcpAttempt = 0;

  LOG_INFO("[eth] state=stopped");
}

void EthernetManager::loadEthernetConfigFromJson(AppSettings& s) {
  if (!SPIFFS.begin(false)) {
    LOG_INFO("[eth] config.json not available: SPIFFS not mounted");
    return;
  }

  if (!SPIFFS.exists("/config.json")) {
    LOG_INFO("[eth] config.json not found, using defaults/NVS");
    return;
  }

  File file = SPIFFS.open("/config.json", "r");
  if (!file) {
    LOG_INFO("[eth] failed to open config.json");
    return;
  }

  String content = file.readString();
  file.close();

  int dhcpIdx = content.indexOf("\"useDhcp\"");
  if (dhcpIdx >= 0) {
    int valIdx = content.indexOf(':', dhcpIdx);
    if (valIdx >= 0) {
      s.w5500UseDhcp = content.substring(valIdx).indexOf("true") >= 0;
    }
  }

  int ipIdx = content.indexOf("\"staticIp\"");
  if (ipIdx >= 0) {
    int start = content.indexOf('"', ipIdx + 12);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.w5500StaticIp = content.substring(start + 1, end);
    }
  }

  int gwIdx = content.indexOf("\"staticGateway\"");
  if (gwIdx >= 0) {
    int start = content.indexOf('"', gwIdx + 16);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.w5500StaticGateway = content.substring(start + 1, end);
    }
  }

  int snIdx = content.indexOf("\"staticSubnet\"");
  if (snIdx >= 0) {
    int start = content.indexOf('"', snIdx + 15);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.w5500StaticSubnet = content.substring(start + 1, end);
    }
  }

  int dnsIdx = content.indexOf("\"staticDns\"");
  if (dnsIdx >= 0) {
    int start = content.indexOf('"', dnsIdx + 13);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.w5500StaticDns = content.substring(start + 1, end);
    }
  }

  LOG_INFO("[eth] loaded ethernet config from JSON: dhcp=%u ip=%s",
            (unsigned)s.w5500UseDhcp, s.w5500StaticIp.c_str());
}

void EthernetManager::saveEthernetConfigToJson(const AppSettings& s) {
  if (!SPIFFS.begin(false)) {
    LOG_INFO("[eth] cannot save config.json: SPIFFS not mounted");
    return;
  }

  String json = "{\n";
  json += "  \"ethernet\": {\n";
  json += "    \"useDhcp\": " + String(s.w5500UseDhcp ? "true" : "false") + ",\n";
  json += "    \"staticIp\": \"" + s.w5500StaticIp + "\",\n";
  json += "    \"staticGateway\": \"" + s.w5500StaticGateway + "\",\n";
  json += "    \"staticSubnet\": \"" + s.w5500StaticSubnet + "\",\n";
  json += "    \"staticDns\": \"" + s.w5500StaticDns + "\"\n";
  json += "  }\n";
  json += "}\n";

  File file = SPIFFS.open("/config.json", "w");
  if (!file) {
    LOG_INFO("[eth] failed to open config.json for writing");
    return;
  }

  file.print(json);
  file.close();
  LOG_INFO("[eth] saved ethernet config to config.json");
}
