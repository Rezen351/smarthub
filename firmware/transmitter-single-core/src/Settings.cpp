#include "Settings.h"
#include "config.h"

// Preferences object used by SettingsStore.
static Preferences _prefs;

void SettingsStore::begin() {
  Serial.printf("[nvs] SettingsStore ready (namespace '%s')\n", PREF_NAMESPACE);
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