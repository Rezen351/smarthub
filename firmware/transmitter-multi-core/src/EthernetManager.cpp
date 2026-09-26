#include "EthernetManager.h"
#include "config.h"
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

  Serial.printf("[eth] initialized (transport=%s, dhcp=%u, ip=%s)\n",
                _transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
                (unsigned)_pendingCfg.w5500UseDhcp,
                _pendingCfg.w5500StaticIp.c_str());
}

void EthernetManager::loop() {
  uint32_t now = millis();

  if (_transportPending) {
    applyPendingTransportMode();
    now = millis();
  }

  if (_transportMode == TRANSPORT_ETHERNET) {
    if (!_active) {
      if (_retryAtMs == 0 || (int32_t)(now - _retryAtMs) >= 0) {
        Serial.println("[eth] state=ethernet (starting W5500)");
        initEthernet(_pendingCfg);
        _retryAtMs = millis() + 5000;
      } else {
        Serial.printf("[eth] state=ethernet (retry in %u ms)\n",
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

  if (mode == TRANSPORT_ETHERNET) {
    WiFi.disconnect(false);
    Serial.println("[eth] state=transport-wifi->ethernet");
    initEthernet(_pendingCfg);
  } else {
    Serial.println("[eth] state=transport-ethernet->wifi");
    stopEthernet();
  }

  Serial.printf("[eth] transport mode -> %s\n",
                mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void EthernetManager::requestTransportMode(uint8_t mode) {
  _transportPending = true;
  _transportPendingMode = mode;
  Serial.printf("[eth] transport mode change requested: %s (will apply from loop)\n",
                mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void EthernetManager::updatePendingEthernetConfig(const AppSettings& s) {
  _pendingCfg.w5500UseDhcp = s.w5500UseDhcp;
  _pendingCfg.w5500StaticIp = s.w5500StaticIp;
  _pendingCfg.w5500StaticGateway = s.w5500StaticGateway;
  _pendingCfg.w5500StaticSubnet = s.w5500StaticSubnet;
  _pendingCfg.w5500StaticDns = s.w5500StaticDns;
  _retryAtMs = 0;
  Serial.printf("[eth] pending ethernet config updated: dhcp=%u ip=%s\n",
                (unsigned)s.w5500UseDhcp, s.w5500StaticIp.c_str());
}

void EthernetManager::applyPendingTransportMode() {
  if (!_transportPending) return;
  _transportPending = false;

  uint8_t mode = _transportPendingMode;
  _transportMode = mode;
  _pendingCfg.transportMode = mode;
  _retryAtMs = 0;

  if (mode == TRANSPORT_ETHERNET) {
    WiFi.disconnect(false);
    Serial.println("[eth] state=transport-wifi->ethernet");
    initEthernet(_pendingCfg);
  } else {
    Serial.println("[eth] state=transport-ethernet->wifi");
    stopEthernet();
  }

  Serial.printf("[eth] transport mode -> %s\n",
                mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void EthernetManager::initEthernet(const AppSettings& s) {
  if (_active) {
    Serial.println("[eth] state=already-active");
    return;
  }

  Serial.println("[eth] state=initializing W5500");
  SPI.begin(W5500_SCK_PIN, W5500_MISO_PIN, W5500_MOSI_PIN, W5500_CS_PIN);
  Ethernet.init(W5500_CS_PIN);

  uint8_t ip[4], gw[4], sn[4], dns[4];
  memset(ip, 0, sizeof(ip));
  memset(gw, 0, sizeof(gw));
  memset(sn, 0, sizeof(sn));
  memset(dns, 0, sizeof(dns));
  sscanf(s.w5500StaticIp.c_str(), "%hhu.%hhu.%hhu.%hhu", &ip[0], &ip[1], &ip[2], &ip[3]);
  sscanf(s.w5500StaticGateway.c_str(), "%hhu.%hhu.%hhu.%hhu", &gw[0], &gw[1], &gw[2], &gw[3]);
  sscanf(s.w5500StaticSubnet.c_str(), "%hhu.%hhu.%hhu.%hhu", &sn[0], &sn[1], &sn[2], &sn[3]);
  sscanf(s.w5500StaticDns.c_str(), "%hhu.%hhu.%hhu.%hhu", &dns[0], &dns[1], &dns[2], &dns[3]);

  bool dhcpOk = false;
  if (s.w5500UseDhcp) {
    Serial.println("[eth] state=dhcp-request");
    uint32_t t0 = millis();
    while ((millis() - t0) < 3000) {
      TaskWatchdog::feed("net", 5000);
      if (Ethernet.begin(mac) != 0) {
        dhcpOk = true;
        break;
      }
      delay(500);
    }
    if (!dhcpOk) {
      Serial.println("[eth] state=dhcp-timeout, fallback to static");
      Ethernet.begin(mac, IPAddress(ip[0], ip[1], ip[2], ip[3]),
                     IPAddress(gw[0], gw[1], gw[2], gw[3]),
                     IPAddress(sn[0], sn[1], sn[2], sn[3]),
                     IPAddress(dns[0], dns[1], dns[2], dns[3]));
    }
  } else {
    Serial.printf("[eth] state=static-ip ip=%s gw=%s sn=%s dns=%s\n",
                  s.w5500StaticIp.c_str(), s.w5500StaticGateway.c_str(),
                  s.w5500StaticSubnet.c_str(), s.w5500StaticDns.c_str());
    Ethernet.begin(mac, IPAddress(ip[0], ip[1], ip[2], ip[3]),
                   IPAddress(gw[0], gw[1], gw[2], gw[3]),
                   IPAddress(sn[0], sn[1], sn[2], sn[3]),
                   IPAddress(dns[0], dns[1], dns[2], dns[3]));
  }

  uint32_t ethT0 = millis();
  while ((millis() - ethT0) < 1000) {
    TaskWatchdog::feed("net", 5000);
    yield();
  }

  _ip = Ethernet.localIP();
  _active = true;

  Serial.printf("[eth] state=active ip=%s\n", _ip.toString().c_str());
}

void EthernetManager::stopEthernet() {
  if (!_active) {
    Serial.println("[eth] state=already-stopped");
    return;
  }

  Ethernet.end();
  _active = false;
  _ip = IPAddress(0, 0, 0, 0);
  _retryAtMs = 0;

  Serial.println("[eth] state=stopped");
}

void EthernetManager::loadEthernetConfigFromJson(AppSettings& s) {
  if (!SPIFFS.begin(false)) {
    Serial.println("[eth] config.json not available: SPIFFS not mounted");
    return;
  }

  if (!SPIFFS.exists("/config.json")) {
    Serial.println("[eth] config.json not found, using defaults/NVS");
    return;
  }

  File file = SPIFFS.open("/config.json", "r");
  if (!file) {
    Serial.println("[eth] failed to open config.json");
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

  Serial.printf("[eth] loaded ethernet config from JSON: dhcp=%u ip=%s\n",
                (unsigned)s.w5500UseDhcp, s.w5500StaticIp.c_str());
}

void EthernetManager::saveEthernetConfigToJson(const AppSettings& s) {
  if (!SPIFFS.begin(false)) {
    Serial.println("[eth] cannot save config.json: SPIFFS not mounted");
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
    Serial.println("[eth] failed to open config.json for writing");
    return;
  }

  file.print(json);
  file.close();
  Serial.println("[eth] saved ethernet config to config.json");
}
