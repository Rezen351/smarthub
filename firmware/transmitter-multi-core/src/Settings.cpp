#include "Settings.h"
#include "Logger.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <SPIFFS.h>

// Preferences object used by all SettingsStore methods.
static Preferences _prefs;

// ---------------------------------------------------------------------
//  Cross-core NVS guard
//
//  Preferences/NVS is not reentrant: the sensor task (calibration + totals)
//  and the network task (WiFi configuration, factory reset) share this one
//  `Preferences` handle. Two concurrent begin()/end() pairs corrupt the
//  handle, which is what made the web portal look unresponsive ("Apply
//  configuration" never answered). Every access is therefore serialised
//  through a recursive mutex so nesting (e.g. saveAll()) stays safe.
// ---------------------------------------------------------------------
static SemaphoreHandle_t _nvsMutex = nullptr;

static SemaphoreHandle_t nvsMutex() {
  if (!_nvsMutex) {
    _nvsMutex = xSemaphoreCreateRecursiveMutex();
  }
  return _nvsMutex;
}

static void lockNvs() {
  SemaphoreHandle_t m = nvsMutex();
  if (m) xSemaphoreTakeRecursive(m, portMAX_DELAY);
}

static void unlockNvs() {
  if (_nvsMutex) xSemaphoreGiveRecursive(_nvsMutex);
}

bool isValidIp(const String& s) {
  if (s.length() == 0) return false;

  uint8_t a, b, c, d;
  int n = sscanf(s.c_str(), "%hhu.%hhu.%hhu.%hhu", &a, &b, &c, &d);
  if (n != 4) return false;

  char buf[20];
  snprintf(buf, sizeof(buf), "%u.%u.%u.%u", (unsigned)a, (unsigned)b, (unsigned)c, (unsigned)d);
  return strcmp(s.c_str(), buf) == 0;
}

void loadWifiConfigFromJson(AppSettings& s) {
  if (!SPIFFS.begin(false)) {
    LOG_INFO("wifi", "config.json not available: SPIFFS not mounted");
    return;
  }

  if (!SPIFFS.exists("/config.json")) {
    LOG_INFO("wifi", "config.json not found, using defaults/NVS");
    return;
  }

  File file = SPIFFS.open("/config.json", "r");
  if (!file) {
    LOG_INFO("wifi", "failed to open config.json");
    return;
  }

  String content = file.readString();
  file.close();

  int wifiIdx = content.indexOf("\"wifi\"");
  if (wifiIdx < 0) {
    LOG_INFO("wifi", "no wifi section in config.json");
    return;
  }

  int modeIdx = content.indexOf("\"mode\"", wifiIdx);
  if (modeIdx >= 0) {
    int valIdx = content.indexOf(':', modeIdx);
    if (valIdx >= 0) {
      String valStr = content.substring(valIdx + 1);
      int endIdx = valStr.indexOf(',');
      if (endIdx < 0) endIdx = valStr.indexOf('}');
      if (endIdx > 0) {
        valStr = valStr.substring(0, endIdx);
        valStr.trim();
        s.wifiMode = (uint8_t)valStr.toInt();
      }
    }
  }

  int ssidIdx = content.indexOf("\"ssid\"", wifiIdx);
  if (ssidIdx >= 0) {
    int start = content.indexOf('"', ssidIdx + 7);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.ssid = content.substring(start + 1, end);
    }
  }

  int pskIdx = content.indexOf("\"psk\"", wifiIdx);
  if (pskIdx >= 0) {
    int start = content.indexOf('"', pskIdx + 6);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.wpaPassword = content.substring(start + 1, end);
    }
  }

  int eidIdx = content.indexOf("\"entIdentity\"", wifiIdx);
  if (eidIdx >= 0) {
    int start = content.indexOf('"', eidIdx + 14);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.entIdentity = content.substring(start + 1, end);
    }
  }

  int eusrIdx = content.indexOf("\"entUsername\"", wifiIdx);
  if (eusrIdx >= 0) {
    int start = content.indexOf('"', eusrIdx + 14);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.entUsername = content.substring(start + 1, end);
    }
  }

  int epwdIdx = content.indexOf("\"entPassword\"", wifiIdx);
  if (epwdIdx >= 0) {
    int start = content.indexOf('"', epwdIdx + 14);
    int end = content.indexOf('"', start + 1);
    if (start >= 0 && end > start) {
      s.entPassword = content.substring(start + 1, end);
    }
  }

  LOG_INFO("wifi", "loaded wifi config from JSON: mode=%u ssid='%s'",
           (unsigned)s.wifiMode, s.ssid.c_str());
}

static void applyWifiDefaults(AppSettings& s) {
  if (s.wifiMode != WIFI_MODE_NONE && s.wifiMode != WIFI_MODE_PSK && s.wifiMode != WIFI_MODE_ENT) {
    LOG_WARN("net", "invalid wifiMode=%u, fallback to WIFI_MODE_NONE", (unsigned)s.wifiMode);
    s.wifiMode = WIFI_MODE_NONE;
  }
}

static void applyEthernetDefaults(AppSettings& s) {
  if (s.transportMode != TRANSPORT_WIFI && s.transportMode != TRANSPORT_ETHERNET) {
    LOG_WARN("net", "invalid transportMode=%u, fallback to DEFAULT_TRANSPORT", (unsigned)s.transportMode);
    s.transportMode = DEFAULT_TRANSPORT;
  }
  if (!isValidIp(s.w5500StaticIp)) {
    LOG_WARN("net", "invalid staticIp='%s', fallback to W5500_STATIC_IP", s.w5500StaticIp.c_str());
    s.w5500StaticIp = W5500_STATIC_IP;
  }
  if (!isValidIp(s.w5500StaticGateway)) {
    LOG_WARN("net", "invalid staticGateway='%s', fallback to W5500_STATIC_GATEWAY", s.w5500StaticGateway.c_str());
    s.w5500StaticGateway = W5500_STATIC_GATEWAY;
  }
  if (!isValidIp(s.w5500StaticSubnet)) {
    LOG_WARN("net", "invalid staticSubnet='%s', fallback to W5500_STATIC_SUBNET", s.w5500StaticSubnet.c_str());
    s.w5500StaticSubnet = W5500_STATIC_SUBNET;
  }
  if (!isValidIp(s.w5500StaticDns)) {
    LOG_WARN("net", "invalid staticDns='%s', fallback to W5500_STATIC_DNS", s.w5500StaticDns.c_str());
    s.w5500StaticDns = W5500_STATIC_DNS;
  }
}

static void openWrite() {
  _prefs.begin(PREF_NAMESPACE, false);   // RW
}
static void openRead() {
  _prefs.begin(PREF_NAMESPACE, false);   // RW mode so namespace is auto-created if missing
}
static void close() {
  _prefs.end();
}

void SettingsStore::begin() {
  nvsMutex();
  LOG_INFO("nvs", "SettingsStore ready (namespace '%s')", PREF_NAMESPACE);
}

void SettingsStore::load(AppSettings& s) {
  lockNvs();
  openRead();

  s.wifiMode     = _prefs.isKey("wifiMode") ? _prefs.getUChar("wifiMode") : WIFI_MODE_NONE;
  s.ssid         = _prefs.isKey("ssid")     ? _prefs.getString("ssid")     : "";
  s.wpaPassword  = _prefs.isKey("psk")      ? _prefs.getString("psk")      : "";
  s.entIdentity  = _prefs.isKey("eid")      ? _prefs.getString("eid")      : "";
  s.entUsername  = _prefs.isKey("eusr")     ? _prefs.getString("eusr")     : "";
  s.entPassword  = _prefs.isKey("epwd")     ? _prefs.getString("epwd")     : "";

  s.calOffset    = _prefs.isKey("calOff")   ? _prefs.getFloat("calOff")    : 0.0f;
  s.countsPerKg  = _prefs.isKey("cntPerKg") ? _prefs.getFloat("cntPerKg")  : 0.0f;
  s.calIntercept = _prefs.isKey("calInt")   ? _prefs.getFloat("calInt")    : 0.0f;
  s.calibrated   = _prefs.isKey("calib")    ? _prefs.getBool("calib")      : false;

  s.totalG       = _prefs.isKey("totalG")   ? (double)_prefs.getFloat("totalG") : 0.0;
  s.sampleCount  = _prefs.isKey("count")    ? _prefs.getUInt("count")      : 0;

  s.calPointCount = _prefs.isKey("calPtCnt") ? _prefs.getUChar("calPtCnt") : 0;
  if (s.calPointCount > MAX_CALIBRATION_POINTS) {
    s.calPointCount = 0;
  }
  for (uint8_t i = 0; i < s.calPointCount; i++) {
    char wKey[16], rKey[16];
    snprintf(wKey, sizeof(wKey), "calPtW%u", (unsigned)i);
    snprintf(rKey, sizeof(rKey), "calPtR%u", (unsigned)i);
    s.calPointWeightKg[i] = _prefs.getFloat(wKey);
    s.calPointRawCounts[i] = _prefs.getFloat(rKey);
  }

  s.transportMode = _prefs.isKey("transportMode") ? _prefs.getUChar("transportMode") : DEFAULT_TRANSPORT;
  s.oledEnabled = _prefs.isKey("oledEnabled") ? _prefs.getBool("oledEnabled") : true;

  s.w5500UseDhcp = _prefs.isKey("w5500Dhcp") ? _prefs.getBool("w5500Dhcp") : W5500_USE_DHCP;
  s.w5500StaticIp = _prefs.isKey("w5500Ip") ? _prefs.getString("w5500Ip") : W5500_STATIC_IP;
  s.w5500StaticGateway = _prefs.isKey("w5500Gw") ? _prefs.getString("w5500Gw") : W5500_STATIC_GATEWAY;
  s.w5500StaticSubnet = _prefs.isKey("w5500Sn") ? _prefs.getString("w5500Sn") : W5500_STATIC_SUBNET;
  s.w5500StaticDns = _prefs.isKey("w5500Dns") ? _prefs.getString("w5500Dns") : W5500_STATIC_DNS;

  close();

  applyWifiDefaults(s);
  applyEthernetDefaults(s);

  if (s.calibrated && s.countsPerKg <= 0.0f) {
    s.calibrated = false;
  }

  if (s.wifiMode == WIFI_MODE_PSK) { s.entIdentity = ""; s.entUsername = ""; s.entPassword = ""; }
  if (s.wifiMode == WIFI_MODE_ENT) { s.wpaPassword = ""; }
  unlockNvs();
}

void SettingsStore::saveAll(const AppSettings& s) {
  saveWifi(s);
  saveCalibration(s);
  saveTotals(s.totalG, s.sampleCount);
  saveTransportSettings(s);
}

void SettingsStore::saveWifi(const AppSettings& s) {
  lockNvs();
  openWrite();
  _prefs.putUChar("wifiMode", s.wifiMode);
  _prefs.putString("ssid", s.ssid);
  _prefs.putString("psk", s.wpaPassword);
  _prefs.putString("eid", s.entIdentity);
  _prefs.putString("eusr", s.entUsername);
  _prefs.putString("epwd", s.entPassword);
  close();
  unlockNvs();
}

void SettingsStore::saveCalibration(const AppSettings& s) {
  lockNvs();
  openWrite();
  _prefs.putFloat("calOff", s.calOffset);
  _prefs.putFloat("cntPerKg", s.countsPerKg);
  _prefs.putFloat("calInt", s.calIntercept);
  _prefs.putBool("calib", s.calibrated);
  close();
  unlockNvs();
}

void SettingsStore::saveCalibrationValues(float countsPerKg, float intercept, bool calibrated) {
  lockNvs();
  openWrite();
  _prefs.putFloat("cntPerKg", countsPerKg);
  _prefs.putFloat("calInt", intercept);
  _prefs.putBool("calib", calibrated);
  close();
  unlockNvs();
}

void SettingsStore::saveTotals(double totalG, uint32_t count) {
  lockNvs();
  openWrite();
  _prefs.putFloat("totalG", (float)totalG);
  _prefs.putUInt("count", count);
  close();
  unlockNvs();
}

void SettingsStore::saveTransportSettings(const AppSettings& s) {
  lockNvs();
  openWrite();
  _prefs.putUChar("transportMode", s.transportMode);
  _prefs.putBool("oledEnabled", s.oledEnabled);
  _prefs.putBool("w5500Dhcp", s.w5500UseDhcp);
  _prefs.putString("w5500Ip", s.w5500StaticIp);
  _prefs.putString("w5500Gw", s.w5500StaticGateway);
  _prefs.putString("w5500Sn", s.w5500StaticSubnet);
  _prefs.putString("w5500Dns", s.w5500StaticDns);
  close();
  unlockNvs();
}

void SettingsStore::saveCalibrationPoints(const AppSettings& s) {
  lockNvs();
  openWrite();
  _prefs.putUChar("calPtCnt", s.calPointCount);
  for (uint8_t i = 0; i < s.calPointCount; i++) {
    char wKey[16], rKey[16];
    snprintf(wKey, sizeof(wKey), "calPtW%u", (unsigned)i);
    snprintf(rKey, sizeof(rKey), "calPtR%u", (unsigned)i);
    _prefs.putFloat(wKey, s.calPointWeightKg[i]);
    _prefs.putFloat(rKey, s.calPointRawCounts[i]);
  }
  close();
  unlockNvs();
}

void SettingsStore::loadCalibrationPoints(AppSettings& s) {
  lockNvs();
  openRead();
  s.calPointCount = _prefs.isKey("calPtCnt") ? _prefs.getUChar("calPtCnt") : 0;
  if (s.calPointCount > MAX_CALIBRATION_POINTS) {
    s.calPointCount = 0;
  }
  for (uint8_t i = 0; i < s.calPointCount; i++) {
    char wKey[16], rKey[16];
    snprintf(wKey, sizeof(wKey), "calPtW%u", (unsigned)i);
    snprintf(rKey, sizeof(rKey), "calPtR%u", (unsigned)i);
    s.calPointWeightKg[i] = _prefs.getFloat(wKey);
    s.calPointRawCounts[i] = _prefs.getFloat(rKey);
  }
  close();
  unlockNvs();
}

void SettingsStore::clearCalibrationPoints() {
  lockNvs();
  openWrite();
  _prefs.remove("calPtCnt");
  for (uint8_t i = 0; i < MAX_CALIBRATION_POINTS; i++) {
    char wKey[16], rKey[16];
    snprintf(wKey, sizeof(wKey), "calPtW%u", (unsigned)i);
    snprintf(rKey, sizeof(rKey), "calPtR%u", (unsigned)i);
    _prefs.remove(wKey);
    _prefs.remove(rKey);
  }
  close();
  unlockNvs();
}

void SettingsStore::factoryReset() {
  lockNvs();
  openWrite();
  _prefs.clear();
  close();
  unlockNvs();
}

void SettingsStore::validate(AppSettings& s) {
  bool valid = true;

  if (s.wifiMode == WIFI_MODE_PSK) {
    if (s.ssid.length() < CONFIG_MIN_SSID_LEN || s.ssid.length() > CONFIG_MAX_SSID_LEN) {
      LOG_WARN("net", "invalid ssid length=%u, fallback to empty", (unsigned)s.ssid.length());
      s.ssid = "";
      valid = false;
    }
    if (s.wpaPassword.length() < CONFIG_MIN_PSK_LEN || s.wpaPassword.length() > CONFIG_MAX_PSK_LEN) {
      LOG_WARN("net", "invalid psk length=%u, fallback to empty", (unsigned)s.wpaPassword.length());
      s.wpaPassword = "";
      valid = false;
    }
  }

  if (s.wifiMode == WIFI_MODE_ENT) {
    if (s.entUsername.length() < CONFIG_MIN_ENT_USER_LEN || s.entUsername.length() > CONFIG_MAX_ENT_USER_LEN) {
      LOG_WARN("net", "invalid ent username length=%u, fallback to empty", (unsigned)s.entUsername.length());
      s.entUsername = "";
      valid = false;
    }
    if (s.entPassword.length() < CONFIG_MIN_ENT_PASS_LEN || s.entPassword.length() > CONFIG_MAX_ENT_PASS_LEN) {
      LOG_WARN("net", "invalid ent password length=%u, fallback to empty", (unsigned)s.entPassword.length());
      s.entPassword = "";
      valid = false;
    }
  }

  if (s.transportMode != TRANSPORT_WIFI && s.transportMode != TRANSPORT_ETHERNET) {
    LOG_WARN("net", "invalid transportMode=%u, fallback to DEFAULT_TRANSPORT", (unsigned)s.transportMode);
    s.transportMode = DEFAULT_TRANSPORT;
    valid = false;
  }

  if (!isValidIp(s.w5500StaticIp)) {
    LOG_WARN("net", "invalid staticIp='%s', fallback to W5500_STATIC_IP", s.w5500StaticIp.c_str());
    s.w5500StaticIp = W5500_STATIC_IP;
    valid = false;
  }
  if (!isValidIp(s.w5500StaticGateway)) {
    LOG_WARN("net", "invalid staticGateway='%s', fallback to W5500_STATIC_GATEWAY", s.w5500StaticGateway.c_str());
    s.w5500StaticGateway = W5500_STATIC_GATEWAY;
    valid = false;
  }
  if (!isValidIp(s.w5500StaticSubnet)) {
    LOG_WARN("net", "invalid staticSubnet='%s', fallback to W5500_STATIC_SUBNET", s.w5500StaticSubnet.c_str());
    s.w5500StaticSubnet = W5500_STATIC_SUBNET;
    valid = false;
  }
  if (!isValidIp(s.w5500StaticDns)) {
    LOG_WARN("net", "invalid staticDns='%s', fallback to W5500_STATIC_DNS", s.w5500StaticDns.c_str());
    s.w5500StaticDns = W5500_STATIC_DNS;
    valid = false;
  }

  if (valid) {
    LOG_INFO("net", "config validation passed");
  } else {
    LOG_WARN("net", "config validation found issues, defaults applied");
  }
}