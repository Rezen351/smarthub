#include "Settings.h"
#include "Logger.h"
#include "config.h"

// Preferences object used by SettingsStore.
static Preferences _prefs;

void SettingsStore::begin() {
  LOG_INFO("nvs", "SettingsStore ready (namespace '%s')", PREF_NAMESPACE);
}

void SettingsStore::load(AppSettings& s) {
  _prefs.begin(PREF_NAMESPACE, true); // read-only

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

  _prefs.end();

  if (s.calibrated && s.countsPerKg <= 0.0f) {
    s.calibrated = false;
  }

  if (s.wifiMode == WIFI_MODE_PSK) { s.entIdentity = ""; s.entUsername = ""; s.entPassword = ""; }
  if (s.wifiMode == WIFI_MODE_ENT) { s.wpaPassword = ""; }
}

void SettingsStore::saveAll(const AppSettings& s) {
  saveWifi(s);
  saveCalibration(s);
  saveTotals(s.totalG, s.sampleCount);
  saveTransportSettings(s);
}

void SettingsStore::saveWifi(const AppSettings& s) {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.putUChar("wifiMode", s.wifiMode);
  _prefs.putString("ssid", s.ssid);
  _prefs.putString("psk", s.wpaPassword);
  _prefs.putString("eid", s.entIdentity);
  _prefs.putString("eusr", s.entUsername);
  _prefs.putString("epwd", s.entPassword);
  _prefs.end();
}

void SettingsStore::saveCalibration(const AppSettings& s) {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.putFloat("calOff", s.calOffset);
  _prefs.putFloat("cntPerKg", s.countsPerKg);
  _prefs.putFloat("calInt", s.calIntercept);
  _prefs.putBool("calib", s.calibrated);
  _prefs.end();
}

void SettingsStore::saveCalibrationValues(float countsPerKg, float intercept, bool calibrated) {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.putFloat("cntPerKg", countsPerKg);
  _prefs.putFloat("calInt", intercept);
  _prefs.putBool("calib", calibrated);
  _prefs.end();
}

void SettingsStore::saveTotals(double totalG, uint32_t count) {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.putFloat("totalG", (float)totalG);
  _prefs.putUInt("count", count);
  _prefs.end();
}

void SettingsStore::saveTransportSettings(const AppSettings& s) {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.putUChar("transportMode", s.transportMode);
  _prefs.putBool("oledEnabled", s.oledEnabled);
  _prefs.putBool("w5500Dhcp", s.w5500UseDhcp);
  _prefs.putString("w5500Ip", s.w5500StaticIp);
  _prefs.putString("w5500Gw", s.w5500StaticGateway);
  _prefs.putString("w5500Sn", s.w5500StaticSubnet);
  _prefs.putString("w5500Dns", s.w5500StaticDns);
  _prefs.end();
}

void SettingsStore::saveCalibrationPoints(const AppSettings& s) {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.putUChar("calPtCnt", s.calPointCount);
  for (uint8_t i = 0; i < s.calPointCount; i++) {
    char wKey[16], rKey[16];
    snprintf(wKey, sizeof(wKey), "calPtW%u", (unsigned)i);
    snprintf(rKey, sizeof(rKey), "calPtR%u", (unsigned)i);
    _prefs.putFloat(wKey, s.calPointWeightKg[i]);
    _prefs.putFloat(rKey, s.calPointRawCounts[i]);
  }
  _prefs.end();
}

void SettingsStore::loadCalibrationPoints(AppSettings& s) {
  _prefs.begin(PREF_NAMESPACE, true);
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
  _prefs.end();
}

void SettingsStore::clearCalibrationPoints() {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.remove("calPtCnt");
  for (uint8_t i = 0; i < MAX_CALIBRATION_POINTS; i++) {
    char wKey[16], rKey[16];
    snprintf(wKey, sizeof(wKey), "calPtW%u", (unsigned)i);
    snprintf(rKey, sizeof(rKey), "calPtR%u", (unsigned)i);
    _prefs.remove(wKey);
    _prefs.remove(rKey);
  }
  _prefs.end();
}

void SettingsStore::factoryReset() {
  _prefs.begin(PREF_NAMESPACE, false);
  _prefs.clear();
  _prefs.end();
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