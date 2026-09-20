#include "WebPortal.h"
#include "config.h"

// ---- global handle so WebServer callbacks can reach the instance ----
static WebPortal* gPortal = nullptr;

// =====================================================================
//  HTTP static callback wrappers
// =====================================================================
static void hRoot()            { if (gPortal) gPortal->handleRoot(); }
static void hCaptiveRedirect() { if (gPortal) gPortal->handleCaptiveRedirect(); }
static void hNotFound()        { if (gPortal) gPortal->handleNotFound(); }
static void hStatus()          { if (gPortal) gPortal->handleApiStatus(); }
static void hConfig()          { if (gPortal) gPortal->handleApiConfig(); }
static void hWifi()            { if (gPortal) gPortal->handleApiWifi(); }
static void hTare()            { if (gPortal) gPortal->handleApiTare(); }
static void hCalibrate()       { if (gPortal) gPortal->handleApiCalibrate(); }
static void hCalibrateMulti()  { if (gPortal) gPortal->handleApiCalibrateMulti(); }
static void hResetSession()    { if (gPortal) gPortal->handleApiResetSession(); }
static void hForceAp()         { if (gPortal) gPortal->handleApiForceAp(); }
static void hFactory()         { if (gPortal) gPortal->handleApiFactoryReset(); }

// =====================================================================
//  Initialization & Lifecycle
// =====================================================================
void WebPortal::begin(SharedState* shared, SettingsStore* settings,
                      WifiManager* wifi, ModbusServer* modbus) {
  _shared = shared;
  _settings = settings;
  _wifi = wifi;
  _modbus = modbus;
  gPortal = this;

  // Mount LittleFS filesystem (formatOnFail = true)
  _fsOk = LittleFS.begin(true, "/");
  if (_fsOk) {
    Serial.println("[portal] LittleFS mounted successfully");
  } else {
    Serial.println("[portal] ERROR: LittleFS mount failed!");
  }

  // Register captive portal probe routes (Android, iOS, Windows, ChromeOS)
  _http.on("/",                     HTTP_GET,  hRoot);
  _http.on("/generate_204",         HTTP_GET,  hCaptiveRedirect); // Android
  _http.on("/hotspot-detect.html",   HTTP_GET,  hCaptiveRedirect); // Apple iOS/macOS
  _http.on("/canonical.html",       HTTP_GET,  hCaptiveRedirect);
  _http.on("/ncsi.txt",             HTTP_GET,  hCaptiveRedirect); // Windows
  _http.on("/connecttest.txt",       HTTP_GET,  hCaptiveRedirect);

  // Register REST API endpoints
  _http.on("/api/status",           HTTP_GET,  hStatus);
  _http.on("/api/config",           HTTP_GET,  hConfig);
  _http.on("/api/wifi",             HTTP_POST, hWifi);
  _http.on("/api/tare",             HTTP_POST, hTare);
  _http.on("/api/calibrate",        HTTP_POST, hCalibrate);
  _http.on("/api/calibrate/multi",  HTTP_POST, hCalibrateMulti);
  _http.on("/api/totals/reset",     HTTP_POST, hResetSession);
  _http.on("/api/portal/force",     HTTP_POST, hForceAp);
  _http.on("/api/factory",          HTTP_POST, hFactory);

  // Fallback handler for static files (css, js) and captive portal redirection
  _http.onNotFound(hNotFound);

  _http.begin();
  Serial.println("[portal] HTTP server listening on port 80");
}

void WebPortal::startDns() {
  if (!_wifi || !WiFi.softAPIP()) return;
  _dns.start(53, "*", WiFi.softAPIP());
  Serial.printf("[portal] DNS captive responder started on %s\n",
                WiFi.softAPIP().toString().c_str());
}

void WebPortal::handleClient() {
  _http.handleClient();
  _dns.processNextRequest();
}

void WebPortal::ensureCfg() {
  if (!_cfgLoaded && _settings) {
    _settings->load(_cfg);
    _cfgLoaded = true;
  }
}

void WebPortal::sendJson(uint16_t code, const String& json) {
  _http.send(code, "application/json", json);
}

// =====================================================================
//  LittleFS Static File Serving
// =====================================================================
String WebPortal::getContentType(const String& path) {
  if (path.endsWith(".html") || path.endsWith(".htm")) return "text/html";
  if (path.endsWith(".css"))  return "text/css";
  if (path.endsWith(".js"))   return "application/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png"))  return "image/png";
  if (path.endsWith(".ico"))  return "image/x-icon";
  if (path.endsWith(".svg"))  return "image/svg+xml";
  return "text/plain";
}

bool WebPortal::serveFromLittleFS(String path) {
  if (path.endsWith("/")) {
    path += "index.html";
  }

  if (!_fsOk) {
    return false;
  }

  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    if (file) {
      String contentType = getContentType(path);
      _http.streamFile(file, contentType);
      file.close();
      return true;
    }
  }

  return false;
}

// =====================================================================
//  Web Page & Captive Portal Routing
// =====================================================================
void WebPortal::handleRoot() {
  if (!serveFromLittleFS("/index.html")) {
    // Graceful fallback if LittleFS image has not yet been uploaded
    String fallback = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>E-Tani Weight Transmitter</title>"
                      "<style>body{background:#0a150f;color:#e2e8f0;font-family:sans-serif;padding:24px;line-height:1.6;}"
                      "h1{color:#10b981;}.box{background:#162e20;border:1px solid #1e3f2c;padding:16px;border-radius:8px;}</style></head>"
                      "<body><h1>E-Tani Weight Transmitter</h1><div class='box'>"
                      "<p><strong>LittleFS partition mounted:</strong> " + String(_fsOk ? "YES" : "NO") + "</p>"
                      "<p>Filesystem image (<code>index.html</code>) not found in LittleFS.</p>"
                      "<p>Please build and upload the filesystem using: <code>pio run -t uploadfs</code></p>"
                      "<p><a href='/api/status' style='color:#34d399;'>Inspect /api/status JSON &rarr;</a></p>"
                      "</div></body></html>";
    _http.send(200, "text/html", fallback);
  }
}

void WebPortal::handleCaptiveRedirect() {
  IPAddress apIP = _wifi ? _wifi->apIP() : IPAddress(192, 168, 4, 1);
  String redirectUrl = "http://" + apIP.toString() + "/";
  _http.sendHeader("Location", redirectUrl, true);
  _http.send(302, "text/plain", "Redirecting to setup portal...");
}

void WebPortal::handleNotFound() {
  String uri = _http.uri();

  // Guard against missing API endpoints
  if (uri.startsWith("/api/")) {
    sendJson(404, "{\"ok\":false,\"message\":\"API endpoint not found\"}");
    return;
  }

  // Attempt to serve static asset directly from LittleFS (e.g. /css/style.css, /js/app.js)
  if (serveFromLittleFS(uri)) {
    return;
  }

  // If request comes from an unexpected domain on captive portal, redirect to root
  String host = _http.hostHeader();
  IPAddress apIP = _wifi ? _wifi->apIP() : IPAddress(192, 168, 4, 1);
  if (!host.equalsIgnoreCase(apIP.toString()) && !host.equalsIgnoreCase(WiFi.localIP().toString())) {
    handleCaptiveRedirect();
    return;
  }

  _http.send(404, "text/plain", "404: Not Found");
}

// =====================================================================
//  REST API Implementations
// =====================================================================

// ---- /api/status (GET) ----
void WebPortal::handleApiStatus() {
  ScaleSnapshot s = _shared ? _shared->getSnapshot() : ScaleSnapshot{};
  uint32_t cnt = 0;
  double tg = 0, mn = 0, mx = 0;
  if (_shared) {
    _shared->getSessionTotals(cnt, tg, mn, mx);
  }

  bool sta = _wifi ? _wifi->staConnected() : false;
  String modeName = "AP";
  if (_wifi) {
    if (_wifi->savedMode() == WIFI_MODE_PSK) modeName = "WPA2-PSK";
    else if (_wifi->savedMode() == WIFI_MODE_ENT) modeName = "WPA2-Enterprise";
  }

  String json = "{";
  json += "\"weightKg\":" + String(s.stableWeightG / 1000.0, 4);
  json += ",\"stableG\":" + String(s.stableWeightG, 1);
  json += ",\"raw\":" + String(s.rawSample, 1);
  json += ",\"offset\":" + String(s.offsetCounts, 1);
  json += ",\"countsPerKg\":" + String(s.countsPerKg, 2);
  json += ",\"intercept\":" + String(s.interceptCounts, 1);

  json += ",\"calibrated\":";
  json += (s.calibrated ? "true" : "false");

  json += ",\"sensorReady\":";
  json += (s.rawSample != 0.0f ? "true" : "false");

  json += ",\"totalG\":" + String(tg, 1);
  json += ",\"sampleCount\":" + String((unsigned long)cnt);
  json += ",\"minG\":" + String(mn, 1);
  json += ",\"maxG\":" + String(mx, 1);
  json += ",\"modbusClients\":" + String((_modbus && _modbus->clientConnected()) ? 1 : 0);
  json += ",\"uptime\":" + String((unsigned long)(millis() / 1000));
  json += ",\"fw\":\"" + String(FW_VERSION >> 8) + "." + String(FW_VERSION & 0xFF) + "\"";
  json += ",\"wifi\":{";
  json += "\"modeName\":\"" + modeName + "\"";
  json += ",\"mode\":" + String(_wifi ? _wifi->savedMode() : 0);
  json += ",\"ssid\":\"" + (_wifi ? _wifi->savedSsid() : "") + "\"";

  json += ",\"status\":\"";
  json += (sta ? "connected" : "disconnected");
  json += "\"";

  json += ",\"rssi\":" + String(_wifi ? (int)_wifi->rssi() : -127);
  json += ",\"staIp\":\"" + (sta ? WiFi.localIP().toString() : "") + "\"";
  json += ",\"apSsid\":\"" + (_wifi ? _wifi->apSsid() : "") + "\"";
  json += ",\"apIp\":\"" + (_wifi ? _wifi->apIP().toString() : "") + "\"";
  json += "}";
  json += "}";

  sendJson(200, json);
}

// ---- /api/config (GET) ----
void WebPortal::handleApiConfig() {
  ensureCfg();
  String json = "{";
  json += "\"wifiMode\":" + String(_cfg.wifiMode);
  json += ",\"ssid\":\"" + _cfg.ssid + "\"";
  json += ",\"wpaPassword\":\"" + _cfg.wpaPassword + "\"";
  json += ",\"entIdentity\":\"" + _cfg.entIdentity + "\"";
  json += ",\"entUsername\":\"" + _cfg.entUsername + "\"";
  json += ",\"entPassword\":\"" + _cfg.entPassword + "\"";
  json += "}";
  sendJson(200, json);
}

// ---- /api/wifi (POST form) ----
void WebPortal::handleApiWifi() {
  ensureCfg();
  int mode = _http.hasArg("mode") ? _http.arg("mode").toInt() : (int)WIFI_MODE_NONE;
  _cfg.wifiMode = (uint8_t)mode;
  _cfg.ssid = _http.hasArg("ssid") ? _http.arg("ssid") : "";
  _cfg.wpaPassword = _http.hasArg("psk") ? _http.arg("psk") : "";
  _cfg.entIdentity = _http.hasArg("eid") ? _http.arg("eid") : "";
  _cfg.entUsername = _http.hasArg("eusr") ? _http.arg("eusr") : "";
  _cfg.entPassword = _http.hasArg("epwd") ? _http.arg("epwd") : "";

  if (_settings) _settings->saveWifi(_cfg);
  if (_wifi)     _wifi->applySettings(_cfg);

  sendJson(200, "{\"ok\":true,\"message\":\"WiFi settings saved. Reconnecting...\"}");
}

// ---- /api/tare (POST) ----
void WebPortal::handleApiTare() {
  if (_shared) _shared->requestCommand(CMD_TARE);
  sendJson(200, "{\"ok\":true,\"message\":\"Tare requested - keep scale empty\"}");
}

// ---- /api/calibrate?kg=... (POST) ----
void WebPortal::handleApiCalibrate() {
  float kg = _http.hasArg("kg") ? _http.arg("kg").toFloat() : 0.0f;
  if (kg <= 0.0f) {
    sendJson(400, "{\"ok\":false,\"message\":\"Enter a valid known weight in kg\"}");
    return;
  }
  ensureCfg();
  _cfg.countsPerKg = 0.0f;
  if (_shared) _shared->requestCommand(CMD_CALIBRATE, kg);
  sendJson(200, "{\"ok\":true,\"message\":\"Calibrating with " + String(kg, 3) + " kg\"}");
}

// ---- /api/calibrate/multi (POST) ----
void WebPortal::handleApiCalibrateMulti() {
  float slope = _http.hasArg("slope") ? _http.arg("slope").toFloat() : 0.0f;
  float intercept = _http.hasArg("intercept") ? _http.arg("intercept").toFloat() : 0.0f;
  if (slope <= 0.0f) {
    Serial.println("[portal] /api/calibrate/multi rejected: invalid slope");
    sendJson(400, "{\"ok\":false,\"message\":\"Invalid calibration slope\"}");
    return;
  }
  ensureCfg();
  _cfg.countsPerKg = slope;
  _cfg.calIntercept = intercept;
  _cfg.calibrated = true;
  Serial.printf("[portal] /api/calibrate/multi slope=%.4f intercept=%.4f\n", slope, intercept);
  if (_shared) _shared->requestCommand(CMD_CALIBRATE_MLR, slope, intercept);
  if (_settings) _settings->saveCalibration(_cfg);
  sendJson(200, "{\"ok\":true,\"message\":\"Multi-point calibration applied\"}");
}

// ---- /api/totals/reset (POST) ----
void WebPortal::handleApiResetSession() {
  if (_shared) _shared->requestCommand(CMD_RESET_SESSION);
  sendJson(200, "{\"ok\":true,\"message\":\"Session totals reset successfully\"}");
}

// ---- /api/portal/force (POST) ----
void WebPortal::handleApiForceAp() {
  if (_shared) _shared->requestCommand(CMD_WIPE_WIFI);
  sendJson(200, "{\"ok\":true,\"message\":\"WiFi forgotten; opening setup AP\"}");
}

// ---- /api/factory (POST) ----
void WebPortal::handleApiFactoryReset() {
  if (_settings) _settings->factoryReset();
  sendJson(200, "{\"ok\":true,\"message\":\"Factory reset complete. Rebooting recommended.\" }");
}