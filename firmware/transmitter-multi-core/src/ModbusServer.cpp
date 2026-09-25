#include "ModbusServer.h"
#include "config.h"

// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter
//  ModbusServer implementation — Modbus TCP server on port 502
//
//  Float encoding: IEEE 754 split into two consecutive 16-bit registers,
//  big-endian (high word first).
// =====================================================================

// ---- Helper: encode float → two registers (big-endian) ----
void ModbusServer::putFloat(uint16_t offset, float val) {
  uint32_t raw;
  memcpy(&raw, &val, sizeof(raw));
  _mb.Hreg(offset,     (uint16_t)(raw >> 16));
  _mb.Hreg(offset + 1, (uint16_t)(raw & 0xFFFF));
}

// ---- Helper: decode two registers → float ----
float ModbusServer::getFloat(uint16_t offset) {
  uint32_t raw = ((uint32_t)_mb.Hreg(offset) << 16) | _mb.Hreg(offset + 1);
  float val;
  memcpy(&val, &raw, sizeof(val));
  return val;
}

// ---- begin: store pointers, do not start server yet ----
void ModbusServer::begin(SharedState* shared, SettingsStore* settings, uint8_t transportMode) {
  _shared   = shared;
  _settings = settings;
  _transportMode = transportMode;
}

// ---- startServer: allocate all holding registers and start WiFi TCP ----
void ModbusServer::startServer() {
  for (uint16_t i = 0; i < NUM_REGS; i++) {
    _mb.addHreg(i, 0);
  }

  _mb.Hreg(REG_FW_VER, (uint16_t)FW_VERSION);
  _mb.server(MODBUS_PORT);
  _started = true;

  Serial.printf("[modbus] WiFi server started on port %u (%u holding regs)\n",
                (unsigned)MODBUS_PORT, (unsigned)NUM_REGS);
}

// ---- startEthernetServer: allocate all holding registers and start Ethernet TCP ----
void ModbusServer::startEthernetServer() {
  for (uint16_t i = 0; i < NUM_REGS; i++) {
    _mb.addHreg(i, 0);
  }

  _mb.Hreg(REG_FW_VER, (uint16_t)FW_VERSION);
  _ethServer.begin(MODBUS_PORT);
  _ethServerStarted = true;
  _started = true;

  Serial.printf("[modbus] Ethernet server started on port %u (%u holding regs)\n",
                (unsigned)MODBUS_PORT, (unsigned)NUM_REGS);
}

// ---- loop: poll Modbus stack, then publish if interval elapsed ----
void ModbusServer::loop() {
  if (!_started) return;

  if (_transportMode == TRANSPORT_WIFI) {
    _mb.task();

    uint16_t cmd = _mb.Hreg(REG_CMD);
    if (cmd != 0) {
      float arg = getFloat(REG_CMD_ARG);
      Serial.printf("[modbus] state=cmd-wifi cmd=%u arg=%.4f\n",
                    (unsigned)cmd, arg);
      switch (cmd) {
        case 1:  _shared->requestCommand(CMD_TARE);          break;
        case 2:  _shared->requestCommand(CMD_CALIBRATE, arg); break;
        case 3:  _shared->requestCommand(CMD_RESET_SESSION); break;
        case 4:  _shared->requestCommand(CMD_FLUSH);         break;
        case 99: _shared->requestCommand(CMD_WIPE_WIFI);     break;
        default:
          Serial.printf("[modbus] state=cmd-unknown cmd=%u\n", (unsigned)cmd);
          break;
      }
      _mb.Hreg(REG_CMD, 0);
    }
  } else if (_transportMode == TRANSPORT_ETHERNET) {
    if (_ethClient && !_ethClient.connected()) {
      _ethClient.stop();
    }

    if (!_ethClient) {
      _ethClient = _ethServer.available();
    }

    if (_ethClient) {
      _mb.task();

      uint16_t cmd = _mb.Hreg(REG_CMD);
      if (cmd != 0) {
        float arg = getFloat(REG_CMD_ARG);
        Serial.printf("[modbus] state=cmd-ethernet cmd=%u arg=%.4f\n",
                      (unsigned)cmd, arg);
        switch (cmd) {
          case 1:  _shared->requestCommand(CMD_TARE);          break;
          case 2:  _shared->requestCommand(CMD_CALIBRATE, arg); break;
          case 3:  _shared->requestCommand(CMD_RESET_SESSION); break;
          case 4:  _shared->requestCommand(CMD_FLUSH);         break;
          case 99: _shared->requestCommand(CMD_WIPE_WIFI);     break;
          default:
            Serial.printf("[modbus] state=cmd-unknown cmd=%u\n", (unsigned)cmd);
            break;
        }
        _mb.Hreg(REG_CMD, 0);
      }
    }
  }

  publish(_rssiCache, _wifiModeCache);
}

// ---- setRuntime: inject radio state from main (called before loop) ----
void ModbusServer::setRuntime(int8_t rssi, uint8_t wifiMode) {
  _rssiCache     = rssi;
  _wifiModeCache = wifiMode;
}

// ---- setTransportMode: switch between WiFi and Ethernet Modbus ----
void ModbusServer::setTransportMode(uint8_t mode) {
  _transportMode = mode;
  _started = false;
  _ethServerStarted = false;
  _mb.server(0);

  if (_ethClient) {
    _ethClient.stop();
    _ethClient = EthernetClient();
  }

  if (mode == TRANSPORT_WIFI) {
    startServer();
  } else if (mode == TRANSPORT_ETHERNET) {
    startEthernetServer();
  }

  Serial.printf("[modbus] transport mode -> %s\n",
                mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

// ---- clientConnected: true if at least one TCP client is active ----
bool ModbusServer::clientConnected() {
  if (!_started) return false;

  if (_transportMode == TRANSPORT_WIFI) {
    return _mb.isConnected(_mb.eventSource());
  } else if (_transportMode == TRANSPORT_ETHERNET) {
    return _ethClient && _ethClient.connected();
  }
  return false;
}

// ---- publish: push all current values into holding registers ----
void ModbusServer::publish(int8_t rssi, uint8_t wifiMode) {
  if (!_started) return;

  ScaleSnapshot s = _shared->getSnapshot();
  uint32_t cnt; double tg, mn, mx;
  _shared->getSessionTotals(cnt, tg, mn, mx);

  // Weight & calibration registers (floats, two regs each)
  putFloat(REG_WEIGHT_G, s.weightG);
  putFloat(REG_STABLE_G, s.stableWeightG);
  putFloat(REG_RAW,      s.rawSample);
  putFloat(REG_OFFSET,   s.offsetCounts);
  putFloat(REG_CPK,      s.countsPerKg);
  putFloat(REG_INTERCEPT, s.interceptCounts);

  // Status flags (bit-packed into a single 16-bit register)
  uint16_t status = 0;
  if (s.rawSample != 0.0f)         status |= 0x0001; // HX711 ready
  if (s.calibrated)                status |= 0x0002; // scale calibrated
  if (wifiMode != WIFI_MODE_NONE && rssi > -127)
                                   status |= 0x0004; // STA connected
  if (_shared->commandPending())   status |= 0x0008; // command pending
  _mb.Hreg(REG_STATUS, status);

  // Radio state
  _mb.Hreg(REG_RSSI,      (uint16_t)(int16_t)rssi);
  _mb.Hreg(REG_WIFI_MODE, (uint16_t)wifiMode);

  // Uptime (seconds, wraps at 65535 ≈ 18 h)
  uint32_t upSec = (uint32_t)(millis() / 1000UL);
  _mb.Hreg(REG_UPTIME, (uint16_t)(upSec > 65535U ? 65535U : upSec));

  // Session totals
  _mb.Hreg(REG_SESS_CNT_HI, (uint16_t)(cnt >> 16));
  _mb.Hreg(REG_SESS_CNT_LO, (uint16_t)(cnt & 0xFFFF));
  putFloat(REG_SESS_TOTAL_G,  (float)tg);
  putFloat(REG_SESSION_MIN_G, (float)mn);
  putFloat(REG_SESSION_MAX_G, (float)mx);

  // Client presence indicator
  _mb.Hreg(REG_CLIENT_CONN, clientConnected() ? 1 : 0);
}
