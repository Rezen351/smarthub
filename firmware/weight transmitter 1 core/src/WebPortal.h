#ifndef WEB_PORTAL_H
#define WEB_PORTAL_H

#include <Arduino.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <SPIFFS.h>
#include "SharedState.h"
#include "Settings.h"
#include "WifiManager.h"
#include "ModbusServer.h"

class WebPortal {
public:
  void begin(SharedState* shared, SettingsStore* settings,
             WifiManager* wifi, ModbusServer* modbus);
  void startDns();
  void handleClient();

  void handleRoot();
  void handleCaptiveRedirect();
  void handleNotFound();
  void handleApiStatus();
  void handleApiConfig();
  void handleApiWifi();
  void handleApiTare();
  void handleApiCalibrate();
  void handleApiCalibrateMulti();
  void handleApiCalibrationStart();
  void handleApiCalibrationCapture();
  void handleApiCalibrationFinish();
  void handleApiCalibrationPoints();
  void handleApiResetSession();
  void handleApiForceAp();
  void handleApiFactoryReset();

  void sendJson(uint16_t code, const String& json);

  bool rebootScheduled() const { return _rebootPending; }
  bool fsMounted() const { return _fsOk; }
  String fsInfo() const;
  size_t fsTotalBytes() const;
  size_t fsUsedBytes() const;

private:
  WebServer      _http{80};
  DNSServer      _dns;
  SharedState*   _shared = nullptr;
  SettingsStore* _settings = nullptr;
  WifiManager*   _wifi = nullptr;
  ModbusServer*  _modbus = nullptr;
  AppSettings    _cfg;
  bool           _cfgLoaded = false;
  bool           _fsOk = false;

  bool           _rebootPending = false;
  uint32_t       _rebootAtMs    = 0;

  void ensureCfg();
  bool serveFromSPIFFS(String path);
  String getContentType(const String& path);
  void scheduleReboot(uint32_t delayMs);
  void processPendingReboot();
};

#endif // WEB_PORTAL_H