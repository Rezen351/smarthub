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
#include "Display.h"

// Captive-portal + calibration web UI backed by SPIFFS static assets.
// Always accessible on the Soft-AP IP (and additionally LAN IP when STA is connected).
class WebPortal {
public:
  void begin(SharedState* shared, SettingsStore* settings,
              WifiManager* wifi, ModbusServer* modbus, DisplayManager* display);
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
  void handleApiCalibrationStart();
  void handleApiCalibrationCapture();
  void handleApiCalibrationFinish();
  void handleApiCalibrationPoints();
  void handleApiResetSession();
  void handleApiForceAp();
  void handleApiFactoryReset();
  void handleApiTransport();
  void handleApiNetworkConfig();
  void handleApiEthernetConfig();
  void handleApiDisplayConfig();

  void sendJson(uint16_t code, const String& json);

  // True while a restart is scheduled (the portal stays reachable until the
  // last queued command has been consumed).
  bool rebootScheduled() const { return _rebootPending; }

  // SPIFFS state queries
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
  DisplayManager* _display = nullptr;
  AppSettings    _cfg;
  bool           _cfgLoaded = false;
  bool           _fsOk = false;

  bool           _rebootPending = false;
  uint32_t       _rebootAtMs    = 0;

  void ensureCfg();
  bool serveFromSPIFFS(String path);
  String getContentType(const String& path);

  // Deferred restart so the HTTP response and any pending scale command are
  // completed before the CPU is reset.
  void scheduleReboot(uint32_t delayMs);
  void processPendingReboot();
};

#endif // WEB_PORTAL_H