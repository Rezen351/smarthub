#ifndef WEB_PORTAL_H
#define WEB_PORTAL_H

#include <Arduino.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <LittleFS.h>
#include "SharedState.h"
#include "Settings.h"
#include "WifiManager.h"
#include "ModbusServer.h"

// Captive-portal + calibration web UI backed by LittleFS static assets.
// Always accessible on the Soft-AP IP (and additionally LAN IP when STA is connected).
class WebPortal {
public:
  void begin(SharedState* shared, SettingsStore* settings,
             WifiManager* wifi, ModbusServer* modbus);
  void startDns();          // start DNS responder on the AP IP
  void handleClient();      // service HTTP + DNS (call from network task)

  // Public route handlers so web server callbacks can invoke them
  void handleRoot();
  void handleCaptiveRedirect();
  void handleNotFound();
  void handleApiStatus();
  void handleApiConfig();
  void handleApiWifi();
  void handleApiTare();
  void handleApiCalibrate();
  void handleApiCalibrateMulti();
  void handleApiResetSession();
  void handleApiForceAp();
  void handleApiFactoryReset();

  void sendJson(uint16_t code, const String& json);

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

  void ensureCfg();
  bool serveFromLittleFS(String path);
  String getContentType(const String& path);
};

#endif // WEB_PORTAL_H