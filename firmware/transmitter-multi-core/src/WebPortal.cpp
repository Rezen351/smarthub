#include "WebPortal.h"
#include "config.h"
#include "Logger.h"

// ---- global handle so WebServer callbacks can reach the instance ----
static WebPortal* gPortal = nullptr;

static void sendJsonBounded(WebServer& http, uint16_t code, const char* fmt, ...) {
  char buf[2048];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  http.send(code, "application/json", buf);
}

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
static void hCalibrationStart()  { if (gPortal) gPortal->handleApiCalibrationStart(); }
static void hCalibrationCapture() { if (gPortal) gPortal->handleApiCalibrationCapture(); }
static void hCalibrationFinish()  { if (gPortal) gPortal->handleApiCalibrationFinish(); }
static void hCalibrationPoints()  { if (gPortal) gPortal->handleApiCalibrationPoints(); }
static void hResetSession()    { if (gPortal) gPortal->handleApiResetSession(); }
static void hForceAp()         { if (gPortal) gPortal->handleApiForceAp(); }
static void hFactory()         { if (gPortal) gPortal->handleApiFactoryReset(); }
static void hTransport()       { if (gPortal) gPortal->handleApiTransport(); }
static void hNetworkConfig()   { if (gPortal) gPortal->handleApiNetworkConfig(); }
static void hEthernetConfig()  { if (gPortal) gPortal->handleApiEthernetConfig(); }
static void hDisplayConfig()   { if (gPortal) gPortal->handleApiDisplayConfig(); }

// =====================================================================
//  Initialization & Lifecycle
// =====================================================================
void WebPortal::begin(SharedState* shared, SettingsStore* settings,
                      WifiManager* wifi, ModbusServer* modbus, DisplayManager* display) {
  _shared = shared;
  _settings = settings;
  _wifi = wifi;
  _modbus = modbus;
  _display = display;
  gPortal = this;

  // Mount SPIFFS filesystem (formatOnFail = false to avoid silent corruption)
  _fsOk = SPIFFS.begin(false, "/spiffs", 10, "spiffs");
  if (_fsOk) {
    LOG_INFO("portal", "SPIFFS mounted: %u bytes total, %u bytes used",
                  (unsigned)SPIFFS.totalBytes(),
                  (unsigned)SPIFFS.usedBytes());
  } else {
    LOG_ERROR("portal", "ERROR: SPIFFS mount failed! "
                   "Run 'pio run -t uploadfs' to flash the filesystem image.");
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
  _http.on("/api/calibration/start",  HTTP_POST, hCalibrationStart);
  _http.on("/api/calibration/capture", HTTP_POST, hCalibrationCapture);
  _http.on("/api/calibration/finish",  HTTP_POST, hCalibrationFinish);
  _http.on("/api/calibration/points",  HTTP_GET,  hCalibrationPoints);
  _http.on("/api/totals/reset",     HTTP_POST, hResetSession);
  _http.on("/api/portal/force",     HTTP_POST, hForceAp);
  _http.on("/api/factory",          HTTP_POST, hFactory);
  _http.on("/api/transport",        HTTP_GET,  hTransport);
  _http.on("/api/transport",        HTTP_POST, hTransport);
  _http.on("/api/network/config",   HTTP_POST, hNetworkConfig);
  _http.on("/api/ethernet/config",  HTTP_GET,  hEthernetConfig);
  _http.on("/api/ethernet/config",  HTTP_POST, hEthernetConfig);
  _http.on("/api/display/config",   HTTP_GET,  hDisplayConfig);
  _http.on("/api/display/config",   HTTP_POST, hDisplayConfig);

  // Fallback handler for static files (css, js) and captive portal redirection
  _http.onNotFound(hNotFound);

  _http.begin();
  LOG_INFO("portal", "HTTP server listening on port 80");
}

void WebPortal::startDns() {
  if (!_wifi || !WiFi.softAPIP()) return;
  _dns.start(53, "*", WiFi.softAPIP());
  LOG_INFO("portal", "DNS captive responder started on %s", WiFi.softAPIP().toString().c_str());
}

void WebPortal::handleClient() {
  _http.handleClient();
  _dns.processNextRequest();
  processPendingReboot();   // runs last: the response is already on the wire
}

// =====================================================================
//  Deferred restart
//
//  A calibration / factory reset must survive a power cycle, so the values
//  are written to NVS before the CPU is reset. The restart itself is
//  scheduled instead of being executed inline, which guarantees that
//  (a) the HTTP response reaches the browser and (b) the sensor task has
//  consumed any queued command before the reset happens.
// =====================================================================
void WebPortal::scheduleReboot(uint32_t delayMs) {
  _rebootPending = true;
  _rebootAtMs = millis() + delayMs;
  LOG_INFO("portal", "restart scheduled in %u ms", (unsigned)delayMs);
}

void WebPortal::processPendingReboot() {
  if (!_rebootPending) return;

  // Give the sensor task time to consume the queued calibration command so
  // its own NVS work finishes before the reset.
  if (_shared && _shared->commandProcessing()) {
    _rebootAtMs = millis() + REBOOT_GRACE_MS;
    return;
  }

  if ((int32_t)(millis() - _rebootAtMs) < 0) return;

  _rebootPending = false;
  LOG_INFO("portal", "restarting transmitter now");
  Serial.flush();
  delay(50);
  ESP.restart();
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
//  SPIFFS Static File Serving
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

String WebPortal::fsInfo() const {
  if (!_fsOk) return "not mounted";
  return String("mounted, ") + String(SPIFFS.totalBytes()) + " total, " +
         String(SPIFFS.usedBytes()) + " used, " +
         String(SPIFFS.totalBytes() - SPIFFS.usedBytes()) + " free";
}

size_t WebPortal::fsTotalBytes() const {
  return _fsOk ? SPIFFS.totalBytes() : 0;
}

size_t WebPortal::fsUsedBytes() const {
  return _fsOk ? SPIFFS.usedBytes() : 0;
}

bool WebPortal::serveFromSPIFFS(String path) {
  if (path.endsWith("/")) {
    path += "index.html";
  }

  if (!_fsOk) {
    LOG_INFO("portal", "serveFromSPIFFS skipped: filesystem not mounted");
    return false;
  }

  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  if (!SPIFFS.exists(path)) {
    return false;
  }

  File file = SPIFFS.open(path, "r");
  if (!file) {
    LOG_INFO("portal", "serveFromSPIFFS: failed to open '%s'", path.c_str());
    return false;
  }

  String contentType = getContentType(path);
  _http.streamFile(file, contentType);
  file.close();
  return true;
}

// =====================================================================
//  Web Page & Captive Portal Routing
// =====================================================================
void WebPortal::handleRoot() {
  if (!serveFromSPIFFS("/index.html")) {
    LOG_INFO("portal", "fallback: serving inline HTML (SPIFFS image missing or corrupt)");
    String fallback = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>E-Tani Weight Transmitter</title>"
                      "<style>body{background:#0a150f;color:#e2e8f0;font-family:sans-serif;padding:24px;line-height:1.6;}"
                      "h1{color:#10b981;}.box{background:#162e20;border:1px solid #1e3f2c;padding:16px;border-radius:8px;}</style></head>"
                      "<body><h1>E-Tani Weight Transmitter</h1><div class='box'>"
                      "<p><strong>SPIFFS partition:</strong> " + fsInfo() + "</p>"
                      "<p>Filesystem image (<code>index.html</code>) not found in SPIFFS.</p>"
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
    sendJson(404, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"API_NOT_FOUND\",\"message\":\"API endpoint not found\"},"
                  "\"message\":\"API endpoint not found\"}");
    return;
  }

  // Attempt to serve static asset directly from SPIFFS (e.g. /css/style.css, /js/app.js)
  if (serveFromSPIFFS(uri)) {
    return;
  }

  LOG_INFO("portal", "404: '%s' (fs mounted: %s)", uri.c_str(), _fsOk ? "yes" : "no");

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

  sendJsonBounded(_http, 200,
    "{\"weightKg\":%.4f,\"stableG\":%.1f,\"raw\":%.1f,\"offset\":%.1f,"
    "\"countsPerKg\":%.2f,\"intercept\":%.1f,"
    "\"calibrated\":%s,\"calibrationPoints\":%u,\"rebooting\":%s,\"sensorReady\":%s,"
    "\"totalG\":%.1f,\"sampleCount\":%lu,\"minG\":%.1f,\"maxG\":%.1f,"
    "\"modbusClients\":%u,\"uptime\":%lu,\"fw\":\"%d.%d\","
    "\"wifi\":{\"modeName\":\"%s\",\"mode\":%d,\"ssid\":\"%s\",\"status\":\"%s\","
    "\"rssi\":%d,\"staIp\":\"%s\",\"apSsid\":\"%s\",\"apIp\":\"%s\"},"
    "\"transport\":{\"mode\":%u,\"modeName\":\"%s\",\"state\":\"%s\",\"ethernetActive\":%s,"
    "\"ethernetIp\":\"%s\",\"w5500UseDhcp\":%s,\"w5500StaticIp\":\"%s\","
    "\"w5500StaticGateway\":\"%s\",\"w5500StaticSubnet\":\"%s\",\"w5500StaticDns\":\"%s\"},"
    "\"display\":{\"oledEnabled\":%s}}",
    s.stableWeightG / 1000.0, s.stableWeightG, s.rawSample, s.offsetCounts,
    s.countsPerKg, s.interceptCounts,
    s.calibrated ? "true" : "false",
    _shared ? _shared->calibrationPointCount() : 0,
    _rebootPending ? "true" : "false",
    s.rawSample != 0.0f ? "true" : "false",
    tg, (unsigned long)cnt, mn, mx,
    _modbus && _modbus->clientConnected() ? 1 : 0,
    (unsigned long)(millis() / 1000),
    FW_VERSION >> 8, FW_VERSION & 0xFF,
    modeName.c_str(),
    _wifi ? _wifi->savedMode() : 0,
    _wifi ? _wifi->savedSsid().c_str() : "",
    sta ? "connected" : "disconnected",
    _wifi ? (int)_wifi->rssi() : -127,
    sta ? WiFi.localIP().toString().c_str() : "",
    _wifi ? _wifi->apSsid().c_str() : "",
    _wifi ? _wifi->apIP().toString().c_str() : "",
    _cfg.transportMode,
    _cfg.transportMode == TRANSPORT_WIFI ? "WiFi" : "Ethernet",
    _wifi ? _wifi->transportStateName() : "unknown",
    _wifi && _wifi->ethernetActive() ? "true" : "false",
    _wifi ? _wifi->ethernetIp().toString().c_str() : "",
    _cfg.w5500UseDhcp ? "true" : "false",
    _cfg.w5500StaticIp.c_str(),
    _cfg.w5500StaticGateway.c_str(),
    _cfg.w5500StaticSubnet.c_str(),
    _cfg.w5500StaticDns.c_str(),
    _cfg.oledEnabled ? "true" : "false");
}

// ---- /api/config (GET) ----
void WebPortal::handleApiConfig() {
  ensureCfg();
  sendJsonBounded(_http, 200,
    "{\"wifiMode\":%u,\"ssid\":\"%s\",\"wpaPassword\":\"%s\","
    "\"entIdentity\":\"%s\",\"entUsername\":\"%s\",\"entPassword\":\"%s\","
    "\"transportMode\":%u,\"oledEnabled\":%s,\"w5500UseDhcp\":%s,"
    "\"w5500StaticIp\":\"%s\",\"w5500StaticGateway\":\"%s\","
    "\"w5500StaticSubnet\":\"%s\",\"w5500StaticDns\":\"%s\"}",
    _cfg.wifiMode,
    _cfg.ssid.c_str(),
    _cfg.wpaPassword.c_str(),
    _cfg.entIdentity.c_str(),
    _cfg.entUsername.c_str(),
    _cfg.entPassword.c_str(),
    _cfg.transportMode,
    _cfg.oledEnabled ? "true" : "false",
    _cfg.w5500UseDhcp ? "true" : "false",
    _cfg.w5500StaticIp.c_str(),
    _cfg.w5500StaticGateway.c_str(),
    _cfg.w5500StaticSubnet.c_str(),
    _cfg.w5500StaticDns.c_str());
}

// ---- /api/wifi (POST form) ----
// Saves the new uplink configuration and answers *before* touching the radio.
// The actual reconfiguration is handed to WifiManager::requestSettings(),
// which applies it from the network task loop after WIFI_APPLY_DELAY_MS.
// This is what used to make "Apply Configuration" look unresponsive: the old
// code called WiFi.disconnect()/WiFi.begin() inside the HTTP handler, so the
// browser kept waiting for a response while the radio was torn down.
void WebPortal::handleApiWifi() {
  ensureCfg();

  int mode = _http.hasArg("mode") ? _http.arg("mode").toInt() : (int)WIFI_MODE_NONE;
  if (mode < (int)WIFI_MODE_NONE || mode > (int)WIFI_MODE_ENT) {
    LOG_INFO("portal", "/api/wifi rejected: invalid mode %d", mode);
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_WIFI_MODE\","
                  "\"message\":\"WiFi mode must be 0 (soft-AP only), 1 (WPA2-PSK) or 2 (WPA2-Enterprise)\"},"
                  "\"message\":\"Invalid WiFi mode\"}");
    return;
  }

  _cfg.wifiMode = (uint8_t)mode;
  _cfg.ssid         = _http.hasArg("ssid") ? _http.arg("ssid") : "";
  _cfg.wpaPassword  = _http.hasArg("psk")  ? _http.arg("psk")  : "";
  _cfg.entIdentity  = _http.hasArg("eid")  ? _http.arg("eid")  : "";
  _cfg.entUsername  = _http.hasArg("eusr") ? _http.arg("eusr") : "";
  _cfg.entPassword  = _http.hasArg("epwd") ? _http.arg("epwd") : "";
  _cfg.ssid.trim();
  _cfg.entIdentity.trim();
  _cfg.entUsername.trim();
  _cfgLoaded = true;

  if (_cfg.wifiMode != WIFI_MODE_NONE && _cfg.ssid.length() == 0) {
    LOG_INFO("portal", "/api/wifi rejected: SSID missing");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"SSID_REQUIRED\","
                  "\"message\":\"A network SSID is required when an uplink mode is selected\"},"
                  "\"message\":\"Network SSID is required\"}");
    return;
  }

  if (_cfg.wifiMode == WIFI_MODE_PSK &&
      _cfg.wpaPassword.length() > 0 && _cfg.wpaPassword.length() < 8) {
    LOG_INFO("portal", "/api/wifi rejected: PSK shorter than 8 characters");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"PSK_TOO_SHORT\","
                  "\"message\":\"WPA2-PSK passwords must be at least 8 characters\"},"
                  "\"message\":\"WPA2 password is too short\"}");
    return;
  }

  if (_cfg.wifiMode == WIFI_MODE_ENT && _cfg.entUsername.length() == 0) {
    LOG_INFO("portal", "/api/wifi rejected: enterprise username missing");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"ENTERPRISE_USERNAME_REQUIRED\","
                  "\"message\":\"Username (inner identity) is required for WPA2-Enterprise\"},"
                  "\"message\":\"Enterprise username is required\"}");
    return;
  }

  if (_settings) _settings->saveWifi(_cfg);

  // Answer first: everything below runs after this response is on the wire.
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Configuration saved. Uplink is being applied...\"}");

  if (_wifi) _wifi->requestSettings(_cfg);
  LOG_INFO("portal", "/api/wifi saved (mode=%u, ssid='%s')",
            (unsigned)_cfg.wifiMode, _cfg.ssid.c_str());
}

// ---- /api/tare (POST) ----
void WebPortal::handleApiTare() {
  if (_shared) _shared->requestCommand(CMD_TARE);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Tare requested - keep scale empty\"}");
}

// ---- /api/calibrate?kg=... (POST) ----
// Single-point calibration: derives counts/kg from the live HX711 reading,
// persists it to NVS and restarts the transmitter so the new calibration is
// loaded exactly like after a power cycle.
void WebPortal::handleApiCalibrate() {
  float kg = _http.hasArg("kg") ? _http.arg("kg").toFloat() : 0.0f;
  if (!(kg > 0.0f)) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_REFERENCE_WEIGHT\","
                  "\"message\":\"Enter a valid known weight in kg\"},"
                  "\"message\":\"Invalid reference weight\"}");
    return;
  }

  ScaleSnapshot snap = _shared ? _shared->getSnapshot() : ScaleSnapshot{};
  if (snap.rawSample == 0.0f) {
    LOG_INFO("portal", "/api/calibrate rejected: no HX711 reading available");
    sendJson(409, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"SENSOR_NOT_READY\","
                  "\"message\":\"No HX711 reading available yet. Check the load cell wiring and tare the scale first\"},"
                  "\"message\":\"Sensor is not ready\"}");
    return;
  }

  float countsPerKg = snap.rawSample / kg;
  if (!(countsPerKg > 0.0f)) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_CALIBRATION\","
                  "\"message\":\"Measured raw counts are not positive. Tare the scale, place the reference weight and retry\"},"
                  "\"message\":\"Calibration could not be computed\"}");
    return;
  }

  ensureCfg();
  _cfg.countsPerKg  = countsPerKg;
  _cfg.calIntercept = 0.0f;
  _cfg.calibrated   = true;
  _cfgLoaded        = true;

  // Persist first (the SettingsStore mutex keeps NVS single-writer safe),
  // then let the sensor task refresh the live snapshot, then restart.
  if (_settings) _settings->saveCalibrationValues(countsPerKg, 0.0f, true);
  if (_shared)   _shared->requestCommand(CMD_CALIBRATE_MLR, countsPerKg, 0.0f);

  LOG_INFO("portal", "/api/calibrate persisted countsPerKg=%.4f (reference %.3f kg)", countsPerKg, kg);

  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);
  sendJsonBounded(_http, 200,
    "{\"ok\":true,\"success\":true,"
    "\"data\":{\"countsPerKg\":%.4f,\"referenceKg\":%.4f},"
    "\"message\":\"Calibration saved (%.1f counts/kg). Device is rebooting...\"}",
    countsPerKg, kg, countsPerKg);
}

// ---- /api/calibrate/multi (POST) ----
// Multi-point calibration: the browser sends the averaged counts/kg derived
// from every captured reference point. The value is persisted to NVS and the
// transmitter restarts so it takes effect on a clean boot.
void WebPortal::handleApiCalibrateMulti() {
  float slope = _http.hasArg("slope") ? _http.arg("slope").toFloat() : 0.0f;
  if (!(slope > 0.0f)) {
    LOG_INFO("portal", "/api/calibrate/multi rejected: invalid slope");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_CALIBRATION_SLOPE\","
                  "\"message\":\"Invalid calibration slope: capture at least one reference point first\"},"
                  "\"message\":\"Invalid calibration slope\"}");
    return;
  }

  ensureCfg();
  _cfg.countsPerKg  = slope;
  _cfg.calIntercept = 0.0f;
  _cfg.calibrated   = true;
  _cfgLoaded        = true;

  if (_settings) _settings->saveCalibrationValues(slope, 0.0f, true);
  if (_shared)   _shared->requestCommand(CMD_CALIBRATE_MLR, slope, 0.0f);

  LOG_INFO("portal", "/api/calibrate/multi persisted countsPerKg=%.4f", slope);

  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);
  sendJsonBounded(_http, 200,
    "{\"ok\":true,\"success\":true,"
    "\"data\":{\"countsPerKg\":%.4f},"
    "\"message\":\"Calibration saved (%.1f counts/kg). Device is rebooting...\"}",
    slope, slope);
}

// ---- /api/totals/reset (POST) ----
void WebPortal::handleApiCalibrationStart() {
  if (_shared) {
    _shared->resetCalibrationPoints();
  }
  LOG_INFO("portal", "/api/calibration/start cleared previous calibration points");
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Calibration session started. Place a known weight and capture points.\"}");
}

void WebPortal::handleApiCalibrationCapture() {
  float kg = _http.hasArg("kg") ? _http.arg("kg").toFloat() : 0.0f;
  if (!(kg > 0.0f)) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_REFERENCE_WEIGHT\","
                  "\"message\":\"Enter a valid known weight in kg\"},"
                  "\"message\":\"Invalid reference weight\"}");
    return;
  }

  ScaleSnapshot snap = _shared ? _shared->getSnapshot() : ScaleSnapshot{};
  if (snap.rawSample == 0.0f) {
    sendJson(409, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"SENSOR_NOT_READY\","
                  "\"message\":\"No HX711 reading available yet\"},"
                  "\"message\":\"Sensor is not ready\"}");
    return;
  }

  if (_shared) {
    _shared->requestCommand(CMD_CAPTURE_CAL_POINT, kg, snap.rawSample);
  }

  uint8_t count = _shared ? _shared->calibrationPointCount() : 0;
  LOG_INFO("portal", "/api/calibration/capture queued %.3f kg (points: %d)", kg, (int)count);

  sendJsonBounded(_http, 200,
    "{\"ok\":true,\"success\":true,"
    "\"data\":{\"weightKg\":%.4f,\"rawCounts\":%.1f,\"pointCount\":%u},"
    "\"message\":\"Calibration point captured (%u points)\"}",
    kg, snap.rawSample, (unsigned)count, (unsigned)count);
}

void WebPortal::handleApiCalibrationFinish() {
  if (!_shared) {
    sendJson(500, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"Shared state unavailable\"},"
                  "\"message\":\"Internal error\"}");
    return;
  }

  uint8_t pointCount = _shared->calibrationPointCount();
  if (pointCount < 2) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INSUFFICIENT_POINTS\","
                  "\"message\":\"At least 2 calibration points are required for regression\"},"
                  "\"message\":\"Insufficient calibration points\"}");
    return;
  }

  float slope = 0.0f;
  float intercept = 0.0f;
  if (!_shared->computeLinearRegression(slope, intercept)) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"REGRESSION_FAILED\","
                  "\"message\":\"Could not compute linear regression from calibration points\"},"
                  "\"message\":\"Regression failed\"}");
    return;
  }

  ensureCfg();
  _cfg.countsPerKg = slope;
  _cfg.calIntercept = intercept;
  _cfg.calibrated = true;
  _cfgLoaded = true;

  if (_settings) {
    _settings->saveCalibrationValues(slope, intercept, true);
    AppSettings a;
    _settings->load(a);
    a.calPointCount = pointCount;
    for (uint8_t i = 0; i < pointCount; i++) {
      CalibrationPoint p = _shared->getCalibrationPoint(i);
      a.calPointWeightKg[i] = p.weightKg;
      a.calPointRawCounts[i] = p.rawCounts;
    }
    _settings->saveCalibrationPoints(a);
  }

  if (_shared) {
    _shared->requestCommand(CMD_CALIBRATE_MLR, slope, intercept);
  }

  LOG_INFO("portal", "/api/calibration/finish persisted slope=%.4f intercept=%.4f points=%d",
            slope, intercept, (int)pointCount);

  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);

  char pointsBuf[512];
  int pointsLen = 0;
  for (uint8_t i = 0; i < pointCount; i++) {
    CalibrationPoint p = _shared->getCalibrationPoint(i);
    int n = snprintf(pointsBuf + pointsLen, sizeof(pointsBuf) - (size_t)pointsLen,
                     "%s{\"kg\":%.4f,\"counts\":%.1f}", i > 0 ? "," : "", p.weightKg, p.rawCounts);
    if (n > 0) pointsLen += n;
  }

  sendJsonBounded(_http, 200,
    "{\"ok\":true,\"success\":true,"
    "\"data\":{\"countsPerKg\":%.4f,\"intercept\":%.4f,\"points\":[%s]},"
    "\"message\":\"Multi-point calibration saved. Rebooting...\"}",
    slope, intercept, pointsBuf);
}

void WebPortal::handleApiCalibrationPoints() {
  if (!_shared) {
    sendJson(500, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"Shared state unavailable\"},"
                  "\"message\":\"Internal error\"}");
    return;
  }

  uint8_t pointCount = _shared->calibrationPointCount();
  char pointsBuf[512];
  int pointsLen = 0;
  for (uint8_t i = 0; i < pointCount; i++) {
    CalibrationPoint p = _shared->getCalibrationPoint(i);
    int n = snprintf(pointsBuf + pointsLen, sizeof(pointsBuf) - (size_t)pointsLen,
                     "%s{\"kg\":%.4f,\"counts\":%.1f}", i > 0 ? "," : "", p.weightKg, p.rawCounts);
    if (n > 0) pointsLen += n;
  }

  sendJsonBounded(_http, 200,
    "{\"ok\":true,\"success\":true,"
    "\"data\":{\"points\":[%s]}}",
    pointsBuf);
}

void WebPortal::handleApiResetSession() {
  if (_shared) _shared->requestCommand(CMD_RESET_SESSION);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Session totals reset successfully\"}");
}

// ---- /api/portal/force (POST) ----
// Forgets the uplink credentials, drops the STA link and reboots so the unit
// comes back up as a pure soft-AP setup hotspot (calibration is untouched).
void WebPortal::handleApiForceAp() {
  ensureCfg();
  _cfg.wifiMode = WIFI_MODE_NONE;
  _cfg.ssid = "";         _cfg.wpaPassword = "";
  _cfg.entIdentity = "";  _cfg.entUsername = "";  _cfg.entPassword = "";
  _cfgLoaded = true;

  if (_settings) _settings->saveWifi(_cfg);

  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"WiFi credentials cleared. Device is rebooting into the setup AP...\"}");

  if (_wifi) _wifi->requestSettings(_cfg);
  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);
}

// ---- /api/factory (POST) ----
void WebPortal::handleApiFactoryReset() {
  if (_settings) _settings->factoryReset();
  _cfgLoaded = false;
  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Factory reset complete. Device is rebooting...\"}");
}

void WebPortal::handleApiTransport() {
  ensureCfg();

  if (_http.method() == HTTP_GET) {
    sendJsonBounded(_http, 200,
      "{\"transportMode\":%u,\"wifiMode\":%u,\"ssid\":\"%s\","
      "\"staConnected\":%s,\"ethernetActive\":%s,\"ethernetIp\":\"%s\","
      "\"transportState\":\"%s\","
      "\"apSsid\":\"%s\",\"apIp\":\"%s\"}",
      _cfg.transportMode,
      _cfg.wifiMode,
      _cfg.ssid.c_str(),
      _wifi && _wifi->staConnected() ? "true" : "false",
      _wifi && _wifi->ethernetActive() ? "true" : "false",
      _wifi ? _wifi->ethernetIp().toString().c_str() : "",
      _wifi ? _wifi->transportStateName() : "unknown",
      _wifi ? _wifi->apSsid().c_str() : "",
      _wifi ? _wifi->apIP().toString().c_str() : "");
    return;
  }

  int mode = _http.hasArg("mode") ? _http.arg("mode").toInt() : (int)DEFAULT_TRANSPORT;
  if (mode != TRANSPORT_WIFI && mode != TRANSPORT_ETHERNET) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_TRANSPORT_MODE\",\"message\":\"Transport mode must be 0 (WiFi) or 1 (Ethernet)\"},"
                  "\"message\":\"Invalid transport mode\"}");
    return;
  }

  _cfg.transportMode = (uint8_t)mode;
  _cfgLoaded = true;

  if (_settings) _settings->saveAll(_cfg);
  if (_wifi) _wifi->requestTransportMode((uint8_t)mode);
  if (_modbus) _modbus->requestTransportMode((uint8_t)mode);

  LOG_INFO("portal", "/api/transport saved (mode=%u)", (unsigned)mode);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Transport mode saved. Applying...\"}");
}

void WebPortal::handleApiNetworkConfig() {
  ensureCfg();

  int mode = _http.hasArg("transportMode") ? _http.arg("transportMode").toInt() : (int)_cfg.transportMode;
  if (mode != TRANSPORT_WIFI && mode != TRANSPORT_ETHERNET) {
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INVALID_TRANSPORT_MODE\",\"message\":\"Transport mode must be 0 (WiFi) or 1 (Ethernet)\"},"
                  "\"message\":\"Invalid transport mode\"}");
    return;
  }

  _cfg.transportMode = (uint8_t)mode;

  if (mode == TRANSPORT_WIFI) {
    int wifiMode = _http.hasArg("wifiMode") ? _http.arg("wifiMode").toInt() : (int)_cfg.wifiMode;
    if (wifiMode < (int)WIFI_MODE_NONE || wifiMode > (int)WIFI_MODE_ENT) {
      sendJson(400, "{\"ok\":false,\"success\":false,"
                    "\"error\":{\"code\":\"INVALID_WIFI_MODE\",\"message\":\"WiFi mode must be 0, 1 or 2\"},"
                    "\"message\":\"Invalid WiFi mode\"}");
      return;
    }

    _cfg.wifiMode = (uint8_t)wifiMode;
    _cfg.ssid         = _http.hasArg("ssid")         ? _http.arg("ssid")         : _cfg.ssid;
    _cfg.wpaPassword  = _http.hasArg("psk")           ? _http.arg("psk")           : _cfg.wpaPassword;
    _cfg.entIdentity  = _http.hasArg("eid")           ? _http.arg("eid")           : _cfg.entIdentity;
    _cfg.entUsername  = _http.hasArg("eusr")          ? _http.arg("eusr")          : _cfg.entUsername;
    _cfg.entPassword  = _http.hasArg("epwd")          ? _http.arg("epwd")          : _cfg.entPassword;
    _cfg.ssid.trim();
    _cfg.entIdentity.trim();
    _cfg.entUsername.trim();

    if (_cfg.wifiMode != WIFI_MODE_NONE && _cfg.ssid.length() == 0) {
      sendJson(400, "{\"ok\":false,\"success\":false,"
                    "\"error\":{\"code\":\"SSID_REQUIRED\",\"message\":\"SSID is required when uplink is enabled\"},"
                    "\"message\":\"SSID is required\"}");
      return;
    }

    if (_cfg.wifiMode == WIFI_MODE_PSK &&
        _cfg.wpaPassword.length() > 0 && _cfg.wpaPassword.length() < 8) {
      sendJson(400, "{\"ok\":false,\"success\":false,"
                    "\"error\":{\"code\":\"PSK_TOO_SHORT\",\"message\":\"WPA2-PSK password must be at least 8 characters\"},"
                    "\"message\":\"WPA2 password is too short\"}");
      return;
    }

    if (_cfg.wifiMode == WIFI_MODE_ENT && _cfg.entUsername.length() == 0) {
      sendJson(400, "{\"ok\":false,\"success\":false,"
                    "\"error\":{\"code\":\"ENTERPRISE_USERNAME_REQUIRED\",\"message\":\"Enterprise username is required\"},"
                    "\"message\":\"Enterprise username is required\"}");
      return;
    }
  }

  if (mode == TRANSPORT_ETHERNET) {
    _cfg.w5500UseDhcp      = _http.hasArg("w5500UseDhcp")      ? (_http.arg("w5500UseDhcp") == "true") : _cfg.w5500UseDhcp;
    _cfg.w5500StaticIp     = _http.hasArg("w5500StaticIp")     ? _http.arg("w5500StaticIp")     : _cfg.w5500StaticIp;
    _cfg.w5500StaticGateway= _http.hasArg("w5500StaticGateway")? _http.arg("w5500StaticGateway"): _cfg.w5500StaticGateway;
    _cfg.w5500StaticSubnet = _http.hasArg("w5500StaticSubnet") ? _http.arg("w5500StaticSubnet") : _cfg.w5500StaticSubnet;
    _cfg.w5500StaticDns    = _http.hasArg("w5500StaticDns")    ? _http.arg("w5500StaticDns")    : _cfg.w5500StaticDns;
  }

  _cfgLoaded = true;

  if (_settings) _settings->saveAll(_cfg);

  if (_wifi) {
    _wifi->updatePendingEthernetConfig(_cfg);
    _wifi->requestTransportMode(_cfg.transportMode);
    if (mode == TRANSPORT_WIFI) {
      _wifi->requestSettings(_cfg);
    }
    _wifi->saveNetworkConfigToJson(_cfg);
  }

  if (_modbus) _modbus->requestTransportMode(_cfg.transportMode);

  LOG_INFO("portal", "/api/network/config saved (transport=%u wifiMode=%u ssid='%s')",
           (unsigned)_cfg.transportMode, (unsigned)_cfg.wifiMode, _cfg.ssid.c_str());
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Network configuration saved. Applying...\"}");
}

void WebPortal::handleApiEthernetConfig() {
  ensureCfg();

  if (_http.method() == HTTP_GET) {
    sendJsonBounded(_http, 200,
      "{\"useDhcp\":%s,\"staticIp\":\"%s\",\"staticGateway\":\"%s\","
      "\"staticSubnet\":\"%s\",\"staticDns\":\"%s\",\"currentIp\":\"%s\","
      "\"active\":%s}",
      _cfg.w5500UseDhcp ? "true" : "false",
      _cfg.w5500StaticIp.c_str(),
      _cfg.w5500StaticGateway.c_str(),
      _cfg.w5500StaticSubnet.c_str(),
      _cfg.w5500StaticDns.c_str(),
      _wifi ? _wifi->ethernetIp().toString().c_str() : "",
      _wifi && _wifi->ethernetActive() ? "true" : "false");
    return;
  }

  bool useDhcp = _http.hasArg("useDhcp") ? _http.arg("useDhcp") == "true" : _cfg.w5500UseDhcp;
  _cfg.w5500UseDhcp = useDhcp;
  _cfg.w5500StaticIp = _http.hasArg("staticIp") ? _http.arg("staticIp") : _cfg.w5500StaticIp;
  _cfg.w5500StaticGateway = _http.hasArg("staticGateway") ? _http.arg("staticGateway") : _cfg.w5500StaticGateway;
  _cfg.w5500StaticSubnet = _http.hasArg("staticSubnet") ? _http.arg("staticSubnet") : _cfg.w5500StaticSubnet;
  _cfg.w5500StaticDns = _http.hasArg("staticDns") ? _http.arg("staticDns") : _cfg.w5500StaticDns;
  _cfgLoaded = true;

  if (_settings) _settings->saveAll(_cfg);
  if (_wifi) {
    _wifi->updatePendingEthernetConfig(_cfg);
    _wifi->requestTransportMode(_cfg.transportMode);
    _wifi->saveNetworkConfigToJson(_cfg);
  }

  LOG_INFO("portal", "/api/ethernet/config saved (dhcp=%u)", (unsigned)useDhcp);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Ethernet configuration saved. Applying...\"}");
}

void WebPortal::handleApiDisplayConfig() {
  ensureCfg();

  if (_http.method() == HTTP_GET) {
    sendJsonBounded(_http, 200, "{\"oledEnabled\":%s}", _cfg.oledEnabled ? "true" : "false");
    return;
  }

  bool enabled = _http.hasArg("enabled") ? _http.arg("enabled") == "true" : _cfg.oledEnabled;
  _cfg.oledEnabled = enabled;
  _cfgLoaded = true;

  if (_display) _display->setEnabled(enabled);
  if (_settings) _settings->saveAll(_cfg);

  LOG_INFO("portal", "/api/display/config saved (oled=%u)", (unsigned)enabled);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Display configuration saved\"}");
}