#include "WifiManager.h"
#include "config.h"
#include "Logger.h"
#include "TaskWatchdog.h"
#include <WiFi.h>

static String buildApSsid() {
  uint64_t mac = ESP.getEfuseMac();
  char suffix[13];
  snprintf(suffix, sizeof(suffix), "%02X%02X%02X%02X%02X%02X",
           (uint8_t)(mac >> 40), (uint8_t)(mac >> 32), (uint8_t)(mac >> 24),
           (uint8_t)(mac >> 16), (uint8_t)(mac >> 8), (uint8_t)mac);
  return String(AP_SSID_PREFIX) + String(suffix);
}

WifiManager::WifiManager() {}

WifiManager::~WifiManager() {}

void WifiManager::begin(const AppSettings& s) {
  _savedMode = s.wifiMode;
  _savedSsid = s.ssid;
  _apSsid = buildApSsid();
  _transportMode = s.transportMode;
  _pendingCfg.transportMode = s.transportMode;

  LOG_INFO("[wifi] initializing (transport=%s, savedMode=%u, ssid='%s')",
            _transportMode == TRANSPORT_ETHERNET ? "Ethernet" : "WiFi",
            (unsigned)_savedMode, _savedSsid.c_str());

  _offline.begin();
  _ethMgr.begin(s);

  WiFi.disconnect(false);
  WiFi.setSleep(false);

  WiFi.mode(WIFI_AP);
  delay(50);

  LOG_INFO("[wifi] starting softAP ssid='%s' channel=%u maxConn=%u hidden=%u",
            _apSsid.c_str(), (unsigned)AP_CHANNEL,
            (unsigned)AP_MAX_CONNECTIONS, (unsigned)AP_HIDDEN);

  bool apOk = WiFi.softAP(_apSsid.c_str(), AP_SSID_PASSWORD,
                          AP_CHANNEL, AP_HIDDEN, AP_MAX_CONNECTIONS);
  if (!apOk) {
    LOG_ERROR("[wifi] ERROR: softAP() returned false, retrying after mode reset...");
    WiFi.mode(WIFI_AP_STA);
    delay(100);
    apOk = WiFi.softAP(_apSsid.c_str(), AP_SSID_PASSWORD,
                       AP_CHANNEL, AP_HIDDEN, AP_MAX_CONNECTIONS);
  }

  uint32_t apT0 = millis();
  while (WiFi.softAPIP() == IPAddress(0, 0, 0, 0)) {
    yield();
    if ((millis() - apT0) > 3000) {
      LOG_ERROR("[wifi] ERROR: softAP IP still 0.0.0.0 after 3 s");
      break;
    }
  }
  LOG_INFO("[wifi] softAP IP=%s (started=%s)",
            WiFi.softAPIP().toString().c_str(),
            apOk ? "yes" : "NO");

  WiFi.mode(WIFI_AP_STA);

  if (_transportMode != TRANSPORT_ETHERNET) {
    LOG_INFO("[wifi] state=ap+sta");
    startSta(s);
  } else {
    LOG_INFO("[wifi] state=ethernet (WiFi STA disabled)");
  }
}

void WifiManager::startSta(const AppSettings& s) {
  _wifiWasConnected = false;
  _wifiReconnectDelayMs = 5000;
  _wifiLastReconnectMs = millis();

  if (s.wifiMode == WIFI_MODE_NONE || s.ssid.length() == 0) {
    WiFi.setAutoReconnect(false);
    WiFi.disconnect(false);
    LOG_INFO("[wifi] state=ap-only (uplink disabled)");
    return;
  }

  WiFi.setAutoReconnect(true);
  WiFi.disconnect(false);
  delay(50);

  if (s.wifiMode == WIFI_MODE_PSK) {
    WiFi.begin(s.ssid.c_str(), s.wpaPassword.c_str());
    LOG_INFO("[wifi] state=connecting mode=psk ssid='%s'", s.ssid.c_str());
  } else if (s.wifiMode == WIFI_MODE_ENT) {
    if (s.entUsername.length() == 0) {
      LOG_INFO("[wifi] state=ap-only (enterprise mode ignored: inner username is empty)");
      return;
    }
    const char* ident = s.entIdentity.length() ? s.entIdentity.c_str() : s.entUsername.c_str();
    WiFi.begin(s.ssid.c_str(), WPA2_AUTH_PEAP, ident,
               s.entUsername.c_str(), s.entPassword.c_str());
    LOG_INFO("[wifi] state=connecting mode=ent ssid='%s' identity='%s'",
                  s.ssid.c_str(), ident);
  }
}

void WifiManager::applySettings(const AppSettings& s) {
  _savedMode = s.wifiMode;
  _savedSsid = s.ssid;
  LOG_INFO("[wifi] applySettings mode=%u ssid='%s'", (unsigned)s.wifiMode, s.ssid.c_str());
  startSta(s);
}

void WifiManager::requestSettings(const AppSettings& s) {
  _pendingCfg = s;
  _savedMode = s.wifiMode;
  _savedSsid = s.ssid;
  _applyPending = true;
  _applyAtMs = millis() + WIFI_APPLY_DELAY_MS;
  LOG_INFO("[wifi] state=pending mode=%u ssid='%s' deferred=%ums",
            (unsigned)s.wifiMode, s.ssid.c_str(), (unsigned)WIFI_APPLY_DELAY_MS);
}

void WifiManager::applyPendingSettings() {
  AppSettings cfg = _pendingCfg;
  _applyPending = false;
  LOG_INFO("[wifi] state=applying deferred configuration");
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

  if (_transportState == TransportState::Switching) {
    applyPendingTransportMode();
    now = millis();
  }

  _ethMgr.loop();

  if ((now - _lastCheck) < 5000) return;
  _lastCheck = now;

  if (_transportMode == TRANSPORT_ETHERNET) {
    return;
  }

  if (_savedMode == WIFI_MODE_NONE || _savedSsid.length() == 0) {
    if (WiFi.status() != WL_CONNECTED && WiFi.getMode() & WIFI_STA) {
      static bool apOnlyLogged = false;
      if (!apOnlyLogged) {
        LOG_INFO("[wifi] state=ap-only (no uplink configured)");
        apOnlyLogged = true;
      }
    }
    return;
  }

  if (staConnected()) {
    if (!_wifiWasConnected) {
      LOG_INFO("[wifi] state=sta-connected ssid='%s' rssi=%d ip=%s",
                    _savedSsid.c_str(), (int)WiFi.RSSI(),
                    WiFi.localIP().toString().c_str());
      _wifiWasConnected = true;
      _wifiReconnectDelayMs = 5000;
    }

    if (_offline.mounted() && _offline.size() > 0) {
      String entry;
      if (_offline.pop(entry)) {
        LOG_INFO("[wifi] drained offline entry (%u remaining)", (unsigned)_offline.size());
      }
    }
    return;
  }

  if (_wifiWasConnected) {
    LOG_INFO("[wifi] state=sta-disconnected mode=%u ssid='%s' status=%d",
                  (unsigned)_savedMode, _savedSsid.c_str(), (int)WiFi.status());
    _wifiWasConnected = false;
  }

  if (_offline.mounted() && !_offline.full() &&
      (int32_t)(millis() - _offlineBufferLastAppendMs) >= 0) {
    char buf[80];
    snprintf(buf, sizeof(buf), "{\"t\":%lu}", (unsigned long)(millis() / 1000));
    if (_offline.append(String(buf))) {
      _offlineBufferLastAppendMs = millis() + 5000;
    }
  }

  if ((int32_t)(millis() - _wifiLastReconnectMs) < 0) {
    return;
  }

  WiFi.setAutoReconnect(true);
  WiFi.reconnect();
  _wifiLastReconnectMs = millis();

  if (_wifiReconnectDelayMs < 10000) {
    _wifiReconnectDelayMs = 10000;
  } else if (_wifiReconnectDelayMs < 30000) {
    _wifiReconnectDelayMs = 30000;
  } else {
    _wifiReconnectDelayMs = 60000;
  }
}

void WifiManager::setTransportMode(uint8_t mode) {
  _transportMode = mode;
  _pendingCfg.transportMode = mode;
  _ethMgr.setTransportMode(mode);

  LOG_INFO("[wifi] transport mode -> %s",
            mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void WifiManager::requestTransportMode(uint8_t mode) {
  _transportState = TransportState::Switching;
  _transportTarget = mode;
  _ethMgr.requestTransportMode(mode);
  LOG_INFO("[wifi] transport mode change requested: %s (will apply from loop)",
            mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void WifiManager::syncPendingEthernetConfig(const AppSettings& s) {
  _pendingCfg.w5500UseDhcp = s.w5500UseDhcp;
  _pendingCfg.w5500StaticIp = s.w5500StaticIp;
  _pendingCfg.w5500StaticGateway = s.w5500StaticGateway;
  _pendingCfg.w5500StaticSubnet = s.w5500StaticSubnet;
  _pendingCfg.w5500StaticDns = s.w5500StaticDns;
  _ethMgr.updatePendingEthernetConfig(s);
  LOG_INFO("[wifi] sync pending ethernet config: dhcp=%u ip=%s",
            (unsigned)s.w5500UseDhcp, s.w5500StaticIp.c_str());
}

void WifiManager::updatePendingEthernetConfig(const AppSettings& s) {
  _pendingCfg.w5500UseDhcp = s.w5500UseDhcp;
  _pendingCfg.w5500StaticIp = s.w5500StaticIp;
  _pendingCfg.w5500StaticGateway = s.w5500StaticGateway;
  _pendingCfg.w5500StaticSubnet = s.w5500StaticSubnet;
  _pendingCfg.w5500StaticDns = s.w5500StaticDns;
  _ethMgr.updatePendingEthernetConfig(s);
  LOG_INFO("[wifi] pending ethernet config updated: dhcp=%u ip=%s",
            (unsigned)s.w5500UseDhcp, s.w5500StaticIp.c_str());
}

void WifiManager::applyPendingTransportMode() {
  if (_transportState != TransportState::Switching) return;

  uint8_t mode = _transportTarget;
  _transportMode = mode;
  _pendingCfg.transportMode = mode;
  _transportState = mode == TRANSPORT_WIFI ? TransportState::WiFi : TransportState::Ethernet;
  _ethMgr.requestTransportMode(mode);

  LOG_INFO("[wifi] transport mode -> %s",
            mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void WifiManager::loadEthernetConfigFromJson(AppSettings& s) {
  _ethMgr.loadEthernetConfigFromJson(s);
}

void WifiManager::saveEthernetConfigToJson(const AppSettings& s) {
  _ethMgr.saveEthernetConfigToJson(s);
}
