#include "ModbusServer.h"
#include "config.h"
#include "Logger.h"
#include "EventBus.h"

extern EventBus gEventBus;

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

  LOG_INFO("modbus", "WiFi server started on port %u (%u holding regs)", (unsigned)MODBUS_PORT, (unsigned)NUM_REGS);
}

// ---- startEthernetServer: allocate all holding registers and start Ethernet TCP ----
void ModbusServer::startEthernetServer() {
  for (uint16_t i = 0; i < NUM_REGS; i++) {
    _mb.addHreg(i, 0);
  }

  _mb.Hreg(REG_FW_VER, (uint16_t)FW_VERSION);
  _ethServer.begin();
  _ethServerStarted = true;
  _started = true;

  LOG_INFO("modbus", "Ethernet server started on port %u (%u holding regs)", (unsigned)MODBUS_PORT, (unsigned)NUM_REGS);
}

// ---- processEthernetModbus: manual MBAP/FC03/06/16 parser for W5500 ----
void ModbusServer::processEthernetModbus() {
  if (!_ethClient || !_ethClient.connected()) {
    if (_ethClient) { _ethClient.stop(); _ethClient = EthernetClient(); }
    _ethRxLen = 0;
    return;
  }

  while (_ethClient.available() > 0 && _ethRxLen < sizeof(_ethRxBuf)) {
    _ethRxBuf[_ethRxLen++] = _ethClient.read();
  }

  if (_ethRxLen < 7) return; // need MBAP header at minimum

  const uint8_t* p = _ethRxBuf;
  uint16_t tid = (uint16_t)p[0] << 8 | p[1];
  (void)tid; // echo back in response
  uint16_t length = (uint16_t)p[4] << 8 | p[5];
  if (_ethRxLen < 7 + length) return; // incomplete frame

  uint8_t unitId = p[6];
  (void)unitId;
  uint8_t fc = p[7];
  uint8_t resp[256];
  uint16_t respLen = 0;
  bool sendError = false;
  uint8_t exc = 0;

  switch (fc) {
    case 0x03: { // Read Holding Registers
      if (_ethRxLen < 12) { sendError = true; exc = 3; break; }
      uint16_t addr = (uint16_t)p[8] << 8 | p[9];
      uint16_t count = (uint16_t)p[10] << 8 | p[11];
      if (addr + count > NUM_REGS || count == 0 || count > 125) {
        sendError = true; exc = 2; break;
      }
      resp[respLen++] = fc;
      resp[respLen++] = count * 2;
      for (uint16_t i = 0; i < count; i++) {
        uint16_t v = _mb.Hreg(addr + i);
        resp[respLen++] = (uint8_t)(v >> 8);
        resp[respLen++] = (uint8_t)(v & 0xFF);
      }
      break;
    }
    case 0x06: { // Write Single Register
      if (_ethRxLen < 12) { sendError = true; exc = 3; break; }
      uint16_t addr = (uint16_t)p[8] << 8 | p[9];
      if (addr >= NUM_REGS) { sendError = true; exc = 2; break; }
      uint16_t val = (uint16_t)p[10] << 8 | p[11];
      _mb.Hreg(addr, val);
      resp[respLen++] = fc;
      resp[respLen++] = p[8];
      resp[respLen++] = p[9];
      resp[respLen++] = p[10];
      resp[respLen++] = p[11];
      break;
    }
    case 0x10: { // Write Multiple Registers
      if (_ethRxLen < 13) { sendError = true; exc = 3; break; }
      uint16_t addr = (uint16_t)p[8] << 8 | p[9];
      uint16_t count = (uint16_t)p[10] << 8 | p[11];
      uint8_t byteCount = p[12];
      if (addr + count > NUM_REGS || count == 0 || count > 123 || byteCount != count * 2) {
        sendError = true; exc = 2; break;
      }
      for (uint16_t i = 0; i < count; i++) {
        uint16_t val = (uint16_t)p[13 + i * 2] << 8 | p[13 + i * 2 + 1];
        _mb.Hreg(addr + i, val);
      }
      resp[respLen++] = fc;
      resp[respLen++] = p[8];
      resp[respLen++] = p[9];
      resp[respLen++] = p[10];
      resp[respLen++] = p[11];
      break;
    }
    default:
      sendError = true;
      exc = 1; // illegal function
      break;
  }

  // Build MBAP response
  uint8_t mbap[7];
  mbap[0] = p[0]; mbap[1] = p[1]; // transaction id echoed
  mbap[2] = 0; mbap[3] = 0;       // protocol id = 0
  mbap[4] = (uint8_t)((respLen + 1) >> 8);
  mbap[5] = (uint8_t)(respLen + 1);
  mbap[6] = p[6];                  // unit id echoed

  if (sendError) {
    mbap[4] = 0; mbap[5] = 2;      // length = 2
    uint8_t errResp[2] = { (uint8_t)(fc | 0x80), exc };
    _ethClient.write(mbap, 7);
    _ethClient.write(errResp, 2);
  } else {
    _ethClient.write(mbap, 7);
    _ethClient.write(resp, respLen);
  }

  _ethRxLen = 0;
}

// ---- loop: poll Modbus stack, then publish if interval elapsed ----
void ModbusServer::loop() {
  if (!_started) return;

  if (_transportState == TransportState::Switching) {
    applyPendingTransportMode();
  }

  if (_transportState == TransportState::WiFi) {
    _mb.task();
  } else if (_transportState == TransportState::Ethernet) {
    if (!_ethClient || !_ethClient.connected()) {
      _ethClient = _ethServer.available();
    }
    processEthernetModbus();
  }

  // Dual-transport: always service Ethernet Modbus clients alongside WiFi
  if (_ethServerStarted) {
    if (!_ethClient || !_ethClient.connected()) {
      _ethClient = _ethServer.available();
    }
    processEthernetModbus();
  }

  // Command register is shared across both transports
  {
    uint16_t cmd = _mb.Hreg(REG_CMD);
    if (cmd != 0) {
      float arg = getFloat(REG_CMD_ARG);
      LOG_INFO("modbus", "state=cmd-%s cmd=%u arg=%.4f",
               _transportState == TransportState::WiFi ? "wifi" : "ethernet",
               (unsigned)cmd, arg);
      Event evt;
      evt.type = EventType::ACTUATOR_COMMAND_RECEIVED;
      evt.priority = EventPriority::NORMAL;
      evt.timestamp_ms = millis();
      evt.sender_id = 0;
      evt.actuator_command.actuator_id = cmd;
      evt.actuator_command.value = arg;
      gEventBus.post(evt);
      switch (cmd) {
        case 1:  _shared->requestCommand(CMD_TARE);          break;
        case 2:  _shared->requestCommand(CMD_CALIBRATE, arg); break;
        case 3:  _shared->requestCommand(CMD_RESET_SESSION); break;
        case 4:  _shared->requestCommand(CMD_FLUSH);         break;
        case 99: _shared->requestCommand(CMD_WIPE_WIFI);     break;
        default:
          LOG_WARN("modbus", "state=cmd-unknown cmd=%u", (unsigned)cmd);
          break;
      }
      _mb.Hreg(REG_CMD, 0);
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
  _transportState = mode == TRANSPORT_WIFI ? TransportState::WiFi : TransportState::Ethernet;
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

  LOG_INFO("modbus", "transport mode -> %s", mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");

  Event evt;
  evt.type = EventType::DEVICE_CONFIG_UPDATED;
  evt.priority = EventPriority::NORMAL;
  evt.timestamp_ms = millis();
  evt.sender_id = 0;
  gEventBus.post(evt);
}

void ModbusServer::requestTransportMode(uint8_t mode) {
  _transportState = TransportState::Switching;
  _transportTarget = mode;
  LOG_INFO("modbus", "transport mode change requested: %s (will apply from loop)", mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");
}

void ModbusServer::applyPendingTransportMode() {
  if (_transportState != TransportState::Switching) return;

  uint8_t mode = _transportTarget;
  _transportMode = mode;
  _transportState = mode == TRANSPORT_WIFI ? TransportState::WiFi : TransportState::Ethernet;
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

  LOG_INFO("modbus", "transport mode -> %s", mode == TRANSPORT_WIFI ? "WiFi" : "Ethernet");

  Event evt;
  evt.type = EventType::DEVICE_CONFIG_UPDATED;
  evt.priority = EventPriority::NORMAL;
  evt.timestamp_ms = millis();
  evt.sender_id = 0;
  gEventBus.post(evt);
}

// ---- clientConnected: true if at least one TCP client is active ----
bool ModbusServer::clientConnected() {
  if (!_started) return false;

  if (_transportState == TransportState::WiFi) {
    return _mb.isConnected(_mb.eventSource());
  } else if (_transportState == TransportState::Ethernet) {
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
