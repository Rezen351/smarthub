#ifndef MODBUS_SERVER_H
#define MODBUS_SERVER_H

// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (Multi-Core)
//  ModbusServer — Modbus TCP server (port 502)
//
//  Uses ModbusTCP from emelianov/modbus-esp8266.
//  Supports WiFi (ModbusTCP) and Ethernet (W5500 via Arduino Ethernet library).
// =====================================================================

#include <Arduino.h>
#include <ModbusTCP.h>
#include <Ethernet.h>
#include "SharedState.h"
#include "Settings.h"
#include "Transport.h"

class ModbusServer {
 public:
  // Store shared-state and settings pointers.
  void begin(SharedState* shared, SettingsStore* settings, uint8_t transportMode = DEFAULT_TRANSPORT);

  // Allocate all holding registers and start TCP listener on MODBUS_PORT.
  void startServer();

  // Start Ethernet TCP listener on MODBUS_PORT.
  void startEthernetServer();

  // Poll Modbus stack + check command register. Call every MODBUS_POLL_MS.
  void loop();

  // Inject radio state before loop() so publish() can embed it.
  void setRuntime(int8_t rssi, uint8_t wifiMode);

  // True when at least one Modbus TCP client is tracked as connected.
  bool clientConnected();

  // True when the Modbus TCP server is listening on MODBUS_PORT.
  bool serverRunning() const { return _started; }

  void setTransportMode(uint8_t mode);
  void requestTransportMode(uint8_t mode);
  uint8_t transportMode() const { return _transportMode; }

  // ---- Holding register offset constants (0-indexed from 40001) ----
  static const uint16_t REG_WEIGHT_G      = 0;   // 40001-02  F32 R
  static const uint16_t REG_STABLE_G      = 2;   // 40003-04  F32 R
  static const uint16_t REG_RAW           = 4;   // 40005-06  F32 R
  static const uint16_t REG_OFFSET        = 6;   // 40007-08  F32 R
  static const uint16_t REG_CPK           = 8;   // 40009-10  F32 R
  static const uint16_t REG_STATUS        = 10;  // 40011     U16 R
  static const uint16_t REG_RSSI          = 11;  // 40012     I16 R
  static const uint16_t REG_WIFI_MODE     = 12;  // 40013     U16 R
  static const uint16_t REG_FW_VER        = 13;  // 40014     U16 R
  static const uint16_t REG_UPTIME        = 14;  // 40015     U16 R
  static const uint16_t REG_CMD           = 15;  // 40016     U16 R/W
  static const uint16_t REG_CMD_ARG       = 16;  // 40017-18  F32 R/W
  static const uint16_t REG_SESS_CNT_HI   = 18;  // 40019     U16 R
  static const uint16_t REG_SESS_CNT_LO   = 19;  // 40020     U16 R
  static const uint16_t REG_SESS_TOTAL_G  = 20;  // 40021-22  F32 R
  static const uint16_t REG_SESSION_MIN_G = 22;  // 40023-24  F32 R
  static const uint16_t REG_SESSION_MAX_G = 24;  // 40025-26  F32 R
  static const uint16_t REG_CLIENT_CONN   = 26;  // 40027     U16 R
  static const uint16_t REG_RESERVED_1    = 27;  // 40028     U16 R
  static const uint16_t REG_RESERVED_2    = 28;  // 40029     U16 R
  static const uint16_t REG_INTERCEPT     = 29;  // 40030-31  F32 R
  static const uint16_t NUM_REGS          = 31;  // offsets 0..30

 private:
  ModbusTCP      _mb;
  EthernetServer _ethServer{MODBUS_PORT};
  EthernetClient _ethClient;
  bool           _ethServerStarted = false;

  SharedState*   _shared        = nullptr;
  SettingsStore* _settings      = nullptr;

  bool    _started       = false;
  int8_t  _rssiCache     = -127;
  uint8_t _wifiModeCache = 0;
  uint8_t _transportMode = DEFAULT_TRANSPORT;
  TransportState _transportState = TransportState::WiFi;
  uint8_t _transportTarget = DEFAULT_TRANSPORT;

  // Encode/decode float <-> two consecutive holding registers (big-endian).
  void  putFloat(uint16_t offset, float val);
  float getFloat(uint16_t offset);

  // Push all live values into the holding register bank.
  void publish(int8_t rssi, uint8_t wifiMode);

  void applyPendingTransportMode();
};

#endif // MODBUS_SERVER_H
