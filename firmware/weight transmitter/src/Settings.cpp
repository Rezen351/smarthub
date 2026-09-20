#include "Settings.h"

// Preferences object used by all SettingsStore methods.
static Preferences _prefs;

static void openWrite() {
  _prefs.begin(PREF_NAMESPACE, false);   // RW
}
static void openRead() {
  _prefs.begin(PREF_NAMESPACE, false);   // RW mode so namespace is auto-created if missing
}
static void close() {
  _prefs.end();
}

void SettingsStore::load(AppSettings& s) {
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

  close();

  // Sanity: leftover enterprise fields while mode is PSK -> normalize.
  if (s.wifiMode == WIFI_MODE_PSK) { s.entIdentity = ""; s.entUsername = ""; s.entPassword = ""; }
  if (s.wifiMode == WIFI_MODE_ENT) { s.wpaPassword = ""; }
}

void SettingsStore::saveAll(const AppSettings& s) {
  saveWifi(s);
  saveCalibration(s);
  saveTotals(s.totalG, s.sampleCount);
}

void SettingsStore::saveWifi(const AppSettings& s) {
  openWrite();
  _prefs.putUChar("wifiMode", s.wifiMode);
  _prefs.putString("ssid", s.ssid);
  _prefs.putString("psk", s.wpaPassword);
  _prefs.putString("eid", s.entIdentity);
  _prefs.putString("eusr", s.entUsername);
  _prefs.putString("epwd", s.entPassword);
  close();
}

void SettingsStore::saveCalibration(const AppSettings& s) {
  openWrite();
  _prefs.putFloat("calOff", s.calOffset);
  _prefs.putFloat("cntPerKg", s.countsPerKg);
  _prefs.putFloat("calInt", s.calIntercept);
  _prefs.putBool("calib", s.calibrated);
  close();
}

void SettingsStore::saveTotals(double totalG, uint32_t count) {
  openWrite();
  _prefs.putFloat("totalG", (float)totalG);
  _prefs.putUInt("count", count);
  close();
}

void SettingsStore::factoryReset() {
  openWrite();
  _prefs.clear();
  close();
}