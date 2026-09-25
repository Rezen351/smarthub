#include "WebPortal.h"
#include "config.h"

static WebPortal* gPortal = nullptr;

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
static void hEthernetConfig()  { if (gPortal) gPortal->handleApiEthernetConfig(); }
static void hDisplayConfig()   { if (gPortal) gPortal->handleApiDisplayConfig(); }

void WebPortal::begin(SharedState* shared, SettingsStore* settings,
                      WifiManager* wifi, ModbusServer* modbus) {
  _shared = shared;
  _settings = settings;
  _wifi = wifi;
  _modbus = modbus;
  gPortal = this;

  _fsOk = SPIFFS.begin(false, "/spiffs", 10, "spiffs");
  if (_fsOk) {
    Serial.printf("[portal] SPIFFS mounted: %u bytes total, %u bytes used\n",
                  (unsigned)SPIFFS.totalBytes(),
                  (unsigned)SPIFFS.usedBytes());
  } else {
    Serial.println("[portal] ERROR: SPIFFS mount failed! "
                   "Run 'pio run -t uploadfs' to flash the filesystem image.");
  }

  _http.on("/",                     HTTP_GET,  hRoot);
  _http.on("/generate_204",         HTTP_GET,  hCaptiveRedirect);
  _http.on("/hotspot-detect.html",   HTTP_GET,  hCaptiveRedirect);
  _http.on("/canonical.html",       HTTP_GET,  hCaptiveRedirect);
  _http.on("/ncsi.txt",             HTTP_GET,  hCaptiveRedirect);
  _http.on("/connecttest.txt",       HTTP_GET,  hCaptiveRedirect);

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
  _http.on("/api/ethernet/config",  HTTP_GET,  hEthernetConfig);
  _http.on("/api/ethernet/config",  HTTP_POST, hEthernetConfig);
  _http.on("/api/display/config",   HTTP_GET,  hDisplayConfig);
  _http.on("/api/display/config",   HTTP_POST, hDisplayConfig);

  _http.onNotFound(hNotFound);

  _http.begin();
  Serial.println("[portal] HTTP server listening on port 80");
}

void WebPortal::startDns() {
  if (!_wifi || !WiFi.softAPIP()) {
    Serial.println("[portal] state=dns-skipped (no AP IP)");
    return;
  }
  _dns.start(53, "*", WiFi.softAPIP());
  Serial.printf("[portal] state=dns-active ip=%s\n",
                WiFi.softAPIP().toString().c_str());
}

void WebPortal::handleClient() {
  _http.handleClient();
  _dns.processNextRequest();
  processPendingReboot();
}

void WebPortal::scheduleReboot(uint32_t delayMs) {
  _rebootPending = true;
  _rebootAtMs = millis() + delayMs;
  Serial.printf("[portal] state=reboot-scheduled delay=%ums\n", (unsigned)delayMs);
}

void WebPortal::processPendingReboot() {
  if (!_rebootPending) return;

  if (_shared && _shared->commandPending()) {
    if (_rebootAtMs != (uint32_t)-1) {
      Serial.println("[portal] state=reboot-delayed command pending");
    }
    _rebootAtMs = millis() + REBOOT_GRACE_MS;
    return;
  }

  if ((int32_t)(millis() - _rebootAtMs) < 0) return;

  _rebootPending = false;
  Serial.println("[portal] state=rebooting");
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
    Serial.println("[portal] serveFromSPIFFS skipped: filesystem not mounted");
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
    Serial.printf("[portal] serveFromSPIFFS: failed to open '%s'\n", path.c_str());
    return false;
  }

  String contentType = getContentType(path);
  _http.streamFile(file, contentType);
  file.close();
  return true;
}

void WebPortal::handleRoot() {
  if (!serveFromSPIFFS("/index.html")) {
    Serial.println("[portal] fallback: serving inline HTML (SPIFFS image missing or corrupt)");
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

  if (uri.startsWith("/api/")) {
    sendJson(404, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"API_NOT_FOUND\",\"message\":\"API endpoint not found\"},"
                  "\"message\":\"API endpoint not found\"}");
    return;
  }

  if (serveFromSPIFFS(uri)) {
    return;
  }

  Serial.printf("[portal] 404: '%s' (fs mounted: %s)\n", uri.c_str(), _fsOk ? "yes" : "no");

  String host = _http.hostHeader();
  IPAddress apIP = _wifi ? _wifi->apIP() : IPAddress(192, 168, 4, 1);
  if (!host.equalsIgnoreCase(apIP.toString()) && !host.equalsIgnoreCase(WiFi.localIP().toString())) {
    handleCaptiveRedirect();
    return;
  }

  _http.send(404, "text/plain", "404: Not Found");
}

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

  json += ",\"calibrationPoints\":";
  json += String(_shared ? _shared->calibrationPointCount() : 0);

  json += ",\"rebooting\":";
  json += (_rebootPending ? "true" : "false");

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

  json += ",\"transport\":{";
  json += "\"mode\":" + String(_cfg.transportMode);
  json += ",\"modeName\":\"" + String(_cfg.transportMode == TRANSPORT_WIFI ? "WiFi" : "Ethernet") + "\"";
  json += ",\"ethernetActive\":" + String(_wifi && _wifi->ethernetActive() ? "true" : "false");
  json += ",\"ethernetIp\":\"" + (_wifi ? _wifi->ethernetIp().toString() : "") + "\"";
  json += ",\"w5500UseDhcp\":" + String(_cfg.w5500UseDhcp ? "true" : "false");
  json += ",\"w5500StaticIp\":\"" + _cfg.w5500StaticIp + "\"";
  json += ",\"w5500StaticGateway\":\"" + _cfg.w5500StaticGateway + "\"";
  json += ",\"w5500StaticSubnet\":\"" + _cfg.w5500StaticSubnet + "\"";
  json += ",\"w5500StaticDns\":\"" + _cfg.w5500StaticDns + "\"";
  json += "}";

  json += ",\"display\":{";
  json += "\"oledEnabled\":" + String(_cfg.oledEnabled ? "true" : "false");
  json += "}";
  json += "}";

  sendJson(200, json);
}

void WebPortal::handleApiConfig() {
  ensureCfg();
  String json = "{";
  json += "\"wifiMode\":" + String(_cfg.wifiMode);
  json += ",\"ssid\":\"" + _cfg.ssid + "\"";
  json += ",\"wpaPassword\":\"" + _cfg.wpaPassword + "\"";
  json += ",\"entIdentity\":\"" + _cfg.entIdentity + "\"";
  json += ",\"entUsername\":\"" + _cfg.entUsername + "\"";
  json += ",\"entPassword\":\"" + _cfg.entPassword + "\"";
  json += ",\"transportMode\":" + String(_cfg.transportMode);
  json += ",\"oledEnabled\":" + String(_cfg.oledEnabled ? "true" : "false");
  json += ",\"w5500UseDhcp\":" + String(_cfg.w5500UseDhcp ? "true" : "false");
  json += ",\"w5500StaticIp\":\"" + _cfg.w5500StaticIp + "\"";
  json += ",\"w5500StaticGateway\":\"" + _cfg.w5500StaticGateway + "\"";
  json += ",\"w5500StaticSubnet\":\"" + _cfg.w5500StaticSubnet + "\"";
  json += ",\"w5500StaticDns\":\"" + _cfg.w5500StaticDns + "\"";
  json += "}";
  sendJson(200, json);
}

void WebPortal::handleApiWifi() {
  ensureCfg();

  int mode = _http.hasArg("mode") ? _http.arg("mode").toInt() : (int)WIFI_MODE_NONE;
  if (mode < (int)WIFI_MODE_NONE || mode > (int)WIFI_MODE_ENT) {
    Serial.printf("[portal] /api/wifi rejected: invalid mode %d\n", mode);
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
    Serial.println("[portal] /api/wifi rejected: SSID missing");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"SSID_REQUIRED\","
                  "\"message\":\"A network SSID is required when an uplink mode is selected\"},"
                  "\"message\":\"Network SSID is required\"}");
    return;
  }

  if (_cfg.wifiMode == WIFI_MODE_PSK &&
      _cfg.wpaPassword.length() > 0 && _cfg.wpaPassword.length() < 8) {
    Serial.println("[portal] /api/wifi rejected: PSK shorter than 8 characters");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"PSK_TOO_SHORT\","
                  "\"message\":\"WPA2-PSK passwords must be at least 8 characters\"},"
                  "\"message\":\"WPA2 password is too short\"}");
    return;
  }

  if (_cfg.wifiMode == WIFI_MODE_ENT && _cfg.entUsername.length() == 0) {
    Serial.println("[portal] /api/wifi rejected: enterprise username missing");
    sendJson(400, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"ENTERPRISE_USERNAME_REQUIRED\","
                  "\"message\":\"Username (inner identity) is required for WPA2-Enterprise\"},"
                  "\"message\":\"Enterprise username is required\"}");
    return;
  }

  if (_settings) _settings->saveWifi(_cfg);

  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Configuration saved. Uplink is being applied...\"}");

  if (_wifi) _wifi->requestSettings(_cfg);
  Serial.printf("[portal] /api/wifi saved (mode=%u, ssid='%s')\n",
                (unsigned)_cfg.wifiMode, _cfg.ssid.c_str());
}

void WebPortal::handleApiTare() {
  if (_shared) _shared->requestCommand(CMD_TARE);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Tare requested - keep scale empty\"}");
}

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
    Serial.println("[portal] /api/calibrate rejected: no HX711 reading available");
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

  if (_settings) _settings->saveCalibrationValues(countsPerKg, 0.0f, true);
  if (_shared)   _shared->requestCommand(CMD_CALIBRATE_MLR, countsPerKg, 0.0f);

  Serial.printf("[portal] /api/calibrate persisted countsPerKg=%.4f (reference %.3f kg)\n",
                countsPerKg, kg);

  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"data\":{\"countsPerKg\":" + String(countsPerKg, 4) +
                ",\"referenceKg\":" + String(kg, 4) + "},"
                "\"message\":\"Calibration saved (" + String(countsPerKg, 1) +
                " counts/kg). Device is rebooting...\"}");
}

void WebPortal::handleApiCalibrateMulti() {
  float slope = _http.hasArg("slope") ? _http.arg("slope").toFloat() : 0.0f;
  if (!(slope > 0.0f)) {
    Serial.println("[portal] /api/calibrate/multi rejected: invalid slope");
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

  Serial.printf("[portal] /api/calibrate/multi persisted countsPerKg=%.4f\n", slope);

  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"data\":{\"countsPerKg\":" + String(slope, 4) + "},"
                "\"message\":\"Calibration saved (" + String(slope, 1) +
                " counts/kg). Device is rebooting...\"}");
}

void WebPortal::handleApiCalibrationStart() {
  if (_shared) {
    _shared->resetCalibrationPoints();
  }
  Serial.println("[portal] /api/calibration/start cleared previous calibration points");
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
  Serial.printf("[portal] /api/calibration/capture queued %.3f kg (points: %d)\n", kg, (int)count);

  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"data\":{\"weightKg\":" + String(kg, 4) +
                ",\"rawCounts\":" + String(snap.rawSample, 1) +
                ",\"pointCount\":" + String((unsigned)count) + "},"
                "\"message\":\"Calibration point captured (" + String(count) + " points)\"}");
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

  Serial.printf("[portal] /api/calibration/finish persisted slope=%.4f intercept=%.4f points=%d\n",
                slope, intercept, (int)pointCount);

  scheduleReboot(CALIBRATION_REBOOT_DELAY_MS);

  String pointsJson = "[";
  for (uint8_t i = 0; i < pointCount; i++) {
    CalibrationPoint p = _shared->getCalibrationPoint(i);
    if (i > 0) pointsJson += ",";
    pointsJson += "{\"kg\":" + String(p.weightKg, 4) + ",\"counts\":" + String(p.rawCounts, 1) + "}";
  }
  pointsJson += "]";

  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"data\":{\"countsPerKg\":" + String(slope, 4) +
                ",\"intercept\":" + String(intercept, 4) +
                ",\"points\":" + pointsJson + "},"
                "\"message\":\"Multi-point calibration saved. Rebooting...\"}");
}

void WebPortal::handleApiCalibrationPoints() {
  if (!_shared) {
    sendJson(500, "{\"ok\":false,\"success\":false,"
                  "\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"Shared state unavailable\"},"
                  "\"message\":\"Internal error\"}");
    return;
  }

  uint8_t pointCount = _shared->calibrationPointCount();
  String pointsJson = "[";
  for (uint8_t i = 0; i < pointCount; i++) {
    CalibrationPoint p = _shared->getCalibrationPoint(i);
    if (i > 0) pointsJson += ",";
    pointsJson += "{\"kg\":" + String(p.weightKg, 4) + ",\"counts\":" + String(p.rawCounts, 1) + "}";
  }
  pointsJson += "]";

  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"data\":{\"points\":" + pointsJson + "}}");
}

void WebPortal::handleApiResetSession() {
  if (_shared) _shared->requestCommand(CMD_RESET_SESSION);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Session totals reset successfully\"}");
}

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
    String json = "{";
    json += "\"transportMode\":" + String(_cfg.transportMode);
    json += ",\"wifiMode\":" + String(_cfg.wifiMode);
    json += ",\"ssid\":\"" + _cfg.ssid + "\"";
    json += ",\"staConnected\":" + String(_wifi && _wifi->staConnected() ? "true" : "false");
    json += ",\"ethernetActive\":" + String(_wifi && _wifi->ethernetActive() ? "true" : "false");
    json += ",\"ethernetIp\":\"" + (_wifi ? _wifi->ethernetIp().toString() : "") + "\"";
    json += ",\"apSsid\":\"" + (_wifi ? _wifi->apSsid() : "") + "\"";
    json += ",\"apIp\":\"" + (_wifi ? _wifi->apIP().toString() : "") + "\"";
    json += "}";
    sendJson(200, json);
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
  if (_wifi) _wifi->setTransportMode((uint8_t)mode);
  if (_modbus) _modbus->setTransportMode((uint8_t)mode);

  Serial.printf("[portal] /api/transport saved (mode=%u)\n", (unsigned)mode);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Transport mode saved. Applying...\"}");
}

void WebPortal::handleApiEthernetConfig() {
  ensureCfg();

  if (_http.method() == HTTP_GET) {
    String json = "{";
    json += "\"useDhcp\":" + String(_cfg.w5500UseDhcp ? "true" : "false");
    json += ",\"staticIp\":\"" + _cfg.w5500StaticIp + "\"";
    json += ",\"staticGateway\":\"" + _cfg.w5500StaticGateway + "\"";
    json += ",\"staticSubnet\":\"" + _cfg.w5500StaticSubnet + "\"";
    json += ",\"staticDns\":\"" + _cfg.w5500StaticDns + "\"";
    json += ",\"currentIp\":\"" + (_wifi ? _wifi->ethernetIp().toString() : "") + "\"";
    json += ",\"active\":" + String(_wifi && _wifi->ethernetActive() ? "true" : "false");
    json += "}";
    sendJson(200, json);
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
  if (_wifi) _wifi->setTransportMode(_cfg.transportMode);

  Serial.printf("[portal] /api/ethernet/config saved (dhcp=%u)\n", (unsigned)useDhcp);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Ethernet configuration saved. Applying...\"}");
}

void WebPortal::handleApiDisplayConfig() {
  ensureCfg();

  if (_http.method() == HTTP_GET) {
    String json = "{";
    json += "\"oledEnabled\":" + String(_cfg.oledEnabled ? "true" : "false");
    json += "}";
    sendJson(200, json);
    return;
  }

  bool enabled = _http.hasArg("enabled") ? _http.arg("enabled") == "true" : _cfg.oledEnabled;
  _cfg.oledEnabled = enabled;
  _cfgLoaded = true;

  if (_settings) _settings->saveAll(_cfg);

  Serial.printf("[portal] /api/display/config saved (oled=%u)\n", (unsigned)enabled);
  sendJson(200, "{\"ok\":true,\"success\":true,"
                "\"message\":\"Display configuration saved\"}");
}