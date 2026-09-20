#include "WifiManager.h"
#include "config.h"

// Build AP SSID from the ESP32 MAC so multiple units are distinguishable.
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

  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP_STA);                              // both radios on

  WiFi.softAP(_apSsid.c_str(), AP_SSID_PASSWORD, AP_CHANNEL, AP_HIDDEN, AP_MAX_CONNECTIONS);
  delay(100);

  startSta(s);                                          // non-blocking
}

void WifiManager::startSta(const AppSettings& s) {
  // Standalone soft-AP only: drop any previous uplink without stopping the
  // radio, because the soft-AP *is* the configuration portal.
  if (s.wifiMode == WIFI_MODE_NONE || s.ssid.length() == 0) {
    WiFi.setAutoReconnect(false);
    WiFi.disconnect(false);
    Serial.println("[wifi] uplink disabled -> soft-AP setup mode only");
    return;
  }

  WiFi.setAutoReconnect(true);
  WiFi.disconnect(false);                               // clean state
  delay(50);

  if (s.wifiMode == WIFI_MODE_PSK) {
    WiFi.begin(s.ssid.c_str(), s.wpaPassword.c_str());
    Serial.printf("[wifi] connecting to '%s' (WPA2-PSK)\n", s.ssid.c_str());
  } else if (s.wifiMode == WIFI_MODE_ENT) {
    // WPA2-Enterprise, PEAP/MSCHAPv2 (cert-less eduroam-style).
    // The outer identity must not be empty, otherwise the enterprise config
    // is rejected by the WiFi stack: fall back to the inner identity.
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
  Serial.printf("[wifi] apply requested (mode=%u, ssid='%s'), deferred %u ms "
                "so the HTTP response is flushed first\n",
                (unsigned)s.wifiMode, s.ssid.c_str(),
                (unsigned)WIFI_APPLY_DELAY_MS);
}

void WifiManager::applyPendingSettings() {
  AppSettings cfg = _pendingCfg;   // copy: startSta() may block on the radio
  _applyPending = false;
  Serial.println("[wifi] applying deferred configuration now");
  startSta(cfg);
  _lastCheck = millis();           // restart the supervision window
}

bool WifiManager::staConnected() {
  return (WiFi.status() == WL_CONNECTED);
}

int8_t WifiManager::rssi() {
  return staConnected() ? (int8_t)WiFi.RSSI() : (int8_t)-127;
}

void WifiManager::loop() {
  uint32_t now = millis();

  // Deferred configuration apply (requested by the HTTP portal). Runs here,
  // well after the HTTP response has been flushed to the browser.
  if (_applyPending && (int32_t)(now - _applyAtMs) >= 0) {
    applyPendingSettings();
    now = millis();
  }

  if ((now - _lastCheck) < 5000) return;
  _lastCheck = now;

  if (_savedMode == WIFI_MODE_NONE || _savedSsid.length() == 0) return;
  if (staConnected()) return;

  // Uplink dropped -> attempt to rejoin (idempotent when already trying).
  WiFi.setAutoReconnect(true);
  WiFi.reconnect();
}