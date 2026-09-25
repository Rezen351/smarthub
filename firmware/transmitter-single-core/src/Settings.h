#ifndef SETTINGS_H
#define SETTINGS_H

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"
#include "SharedState.h"

// WiFi authentication modes
enum WifiMode : uint8_t {
  WIFI_MODE_NONE = 0,   // no uplink (AP/setup only)
  WIFI_MODE_PSK  = 1,   // WPA2-PSK
  WIFI_MODE_ENT  = 2    // WPA2-Enterprise (PEAP/MSCHAPv2)
};

// All persistent application settings (NVS-backed via Preferences).
struct AppSettings {
  uint8_t  wifiMode = WIFI_MODE_NONE;
  String   ssid;
  String   wpaPassword;
  String   entIdentity;
  String   entUsername;
  String   entPassword;

  float    calOffset   = 0.0f;   // tare offset (raw counts)
  float    countsPerKg = 0.0f;   // calibration slope
  float    calIntercept= 0.0f;   // calibration intercept (raw counts at 0 kg)
  bool     calibrated  = false;

  double   totalG      = 0.0;    // accumulated weight (grams) - stored
  uint32_t sampleCount = 0;      // weighing count - stored

  uint8_t  calPointCount = 0;    // number of valid calibration points
  float    calPointWeightKg[MAX_CALIBRATION_POINTS]; // reference weights (kg)
  float    calPointRawCounts[MAX_CALIBRATION_POINTS]; // raw counts at those weights

  uint8_t  transportMode = DEFAULT_TRANSPORT;  // WiFi or Ethernet
  bool     oledEnabled = true;

  bool     w5500UseDhcp = W5500_USE_DHCP;
  String   w5500StaticIp;
  String   w5500StaticGateway;
  String   w5500StaticSubnet;
  String   w5500StaticDns;
};

class SettingsStore {
public:
  void    begin();

  void    load(AppSettings& s);
  void    saveAll(const AppSettings& s);
  void    saveWifi(const AppSettings& s);
  void    saveCalibration(const AppSettings& s);
  void    saveCalibrationValues(float countsPerKg, float intercept, bool calibrated);
  void    saveTotals(double totalG, uint32_t count);
  void    factoryReset();

  void    saveCalibrationPoints(const AppSettings& s);
  void    loadCalibrationPoints(AppSettings& s);
  void    clearCalibrationPoints();
  void    saveTransportSettings(const AppSettings& s);
};

#endif // SETTINGS_H