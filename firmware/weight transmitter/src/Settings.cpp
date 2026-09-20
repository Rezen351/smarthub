#include "Settings.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

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
  Serial.printf("[nvs] SettingsStore ready (namespace '%s')\n", PREF_NAMESPACE);
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

  close();

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