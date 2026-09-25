#include "WifiManager.h"
#include "config.h"
#include <EthernetENC.h>
#include <SPI.h>

static uint8_t mac[6];

static String buildApSsid() {
  uint64_t mac = ESP.getEfuseMac();
  char suffix[13];
  snprintf(suffix, sizeof(suffix), "%02X%02X%02X%02X%02X%02X",
           (uint8_t)(mac >> 40),
           (uint8_t)(mac >> 32),
           (uint8_t)(mac >> 24),
           (uint8_t)(mac >> 16),
           (uint8_t)(mac >> 8),
           (uint8_t)(mac));
  return String(AP_SSID_PREFIX) + String(suffix);
}

void WifiManager::begin(const AppSettings& s) {
  _savedMode = s.wifiMode;
  _savedSsid = s.ssid;
  _apSsid = buildApSsid();
  _transportMode = s.transportMode;

  uint64_t efuseMac = ESP.getEfuseMac();
  mac[0] = (efuseMac >> 40) & 0xFF;
  mac[1] = (efuseMac >> 32) & 0xFF;
  mac[2] = (efuseMac >> 24) & 0xFF;
  mac[3] = (efuseMac >> 16) & 0xFF;
  mac[4] = (efuseMac >> 8) & 0xFF;
  mac[5] = efuseMac & 0xFF;

  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP_STA);

  WiFi.softAP(_apSsid.c_str(), AP_SSID_PASSWORD, AP_CHANNEL, AP_HIDDEN, AP_MAX_CONNECTIONS);
  delay(100);

  if (_transportMode == TRANSPORT_ETHERNET) {
    beginEthernet(s);
    WiFi.disconnect(false);
  } else {
    stopEthernet();
    startSta(s);
  }
}

void WifiManager::startSta(const AppSettings& s) {
  if (s.wifiMode == WIFI_MODE_NONE || s.ssid.length() == 0) {
    WiFi.setAutoReconnect(false);
    WiFi.disconnect(false);
    Serial.println("[wifi] uplink disabled -> soft-AP setup mode only");
    return;
  }

  WiFi.setAutoReconnect(true);
  WiFi.disconnect(false);
  delay(50);

  if (s.wifiMode == WIFI_MODE_PSK) {
    WiFi.begin(s.ssid.c_str(), s.wpaPassword.c_str());
    Serial.printf("[wifi] connecting to '%s' (WPA2-PSK)\n", s.ssid.c_str());
  } else if (s.wifiMode == WIFI_MODE_ENT) {
    if (s.entUsername.length() == 0) {
      Serial.println("[wifi] enterprise mode ignored: inner username is empty");
      return;
    }
    const char* ident = s.entIdentity.length() ? s.entIdentity.c_str()
                                               : s.entUsername.c_str();
    WiFi.begin(s.ssid.c_str(), WPA2_AUTH_PEAP, ident,
               s.entUsername.c_str(), s.entPassword.c_str());
    Serial.printf("[wifi] connecting to '%s' (WPA2-Enterprise, identity '%s')\n",
                  s.ssid.c_str(), ident);
  }
}

void WifiManager::applySettings(const AppSettings& s) {
  _savedMode = s.wifiMode;
  _savedSsid = s.ssid;
  startSta(s);
}

void WifiManager::requestSettings(const AppSettings& s) {
  _pendingCfg = s;
  _savedMode = s.wifiMode;
  _savedSsid = s.ssid;
  _applyPending = true;
  _applyAtMs = millis() + WIFI_APPLY_DELAY_MS;
  Serial.printf("[wifi] apply requested (mode=%u, ssid='%s'), deferred %u ms\n",
                (unsigned)s.wifiMode, s.ssid.c_str(),
                (unsigned)WIFI_APPLY_DELAY_MS);
}

void WifiManager::applyPendingSettings() {
  AppSettings cfg = _pendingCfg;
  _applyPending = false;
  Serial.println("[wifi] applying deferred configuration now");
  startSta(cfg);
  _lastCheck = millis();
}

bool WifiManager::staConnected() {
  return (WiFi.status() == WL_CONNECTED);
}

int8_t WifiManager::rssi() {
  return staConnected() ? (int8_t)WiFi.RSSI() : (int8_t)-127;
}

void WifiManager::loop() {
  uint32_t now = millis();

  if (_applyPending && (int32_t)(now - _applyAtMs) >= 0) {
    applyPendingSettings();
    now = millis();
  }

  if ((now - _lastCheck) < 5000) return;
  _lastCheck = now;

  if (_transportMode == TRANSPORT_ETHERNET) {
    if (!_ethernetActive) {
      beginEthernet(_pendingCfg);
    }
    return;
  }

  if (_savedMode == WIFI_MODE_NONE || _savedSsid.length() == 0) return;
  if (staConnected()) return;

  WiFi.setAutoReconnect(true);
  WiFi.reconnect();
}

void WifiManager::setTransportMode(uint8_t mode) {
  _transportMode = mode;
  _pendingCfg.transportMode = mode;

  if (mode == TRANSPORT_ETHERNET) {
    WiFi.disconnect(false);
    beginEthernet(_pendingCfg);
  } else {
    stopEthernet();
    startSta(_pendingCfg);
  }

  Serial.printf("[wifi] transport mode -> %s\n",
                mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void WifiManager::beginEthernet(const AppSettings& s) {
  if (_ethernetActive) return;

  Serial.println("[eth] initializing W5500...");
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

  if (s.w5500UseDhcp) {
    Serial.println("[eth] requesting DHCP...");
    if (Ethernet.begin(mac) == 0) {
      Serial.println("[eth] DHCP failed, falling back to static IP");
      Ethernet.begin(mac, IPAddress(ip[0], ip[1], ip[2], ip[3]),
                     IPAddress(gw[0], gw[1], gw[2], gw[3]),
                     IPAddress(sn[0], sn[1], sn[2], sn[3]),
                     IPAddress(dns[0], dns[1], dns[2], dns[3]));
    }
  } else {
    Serial.println("[eth] using static IP");
    Ethernet.begin(mac, IPAddress(ip[0], ip[1], ip[2], ip[3]),
                   IPAddress(gw[0], gw[1], gw[2], gw[3]),
                   IPAddress(sn[0], sn[1], sn[2], sn[3]),
                   IPAddress(dns[0], dns[1], dns[2], dns[3]));
  }

  delay(500);
  _ethernetIp = Ethernet.localIP();
  _ethernetActive = true;

  Serial.printf("[eth] W5500 initialized, IP=%s\n",
                _ethernetIp.toString().c_str());
}

void WifiManager::stopEthernet() {
  if (!_ethernetActive) return;

  Ethernet.end();
  _ethernetActive = false;
  _ethernetIp = IPAddress(0, 0, 0, 0);

  Serial.println("[eth] W5500 stopped");
}