#ifndef MODBUS_SERVER_H
#define MODBUS_SERVER_H

// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter (Single Core)
//  ModbusServer — Modbus TCP server (port 502)
//
//  Uses ModbusTCP from emelianov/modbus-esp8266.
// =====================================================================

#include <Arduino.h>
#include <ModbusTCP.h>
#include "SharedState.h"
#include "Settings.h"

class ModbusServer {
public:
  void begin(SharedState* shared, SettingsStore* settings);
  void startServer();
  void loop();

  void setRuntime(int8_t rssi, uint8_t wifiMode);
  bool clientConnected();

  static const uint16_t REG_WEIGHT_G      = 0;
  static const uint16_t REG_STABLE_G      = 2;
  static const uint16_t REG_RAW           = 4;
  static const uint16_t REG_OFFSET        = 6;
  static const uint16_t REG_CPK           = 8;
  static const uint16_t REG_STATUS        = 10;
  static const uint16_t REG_RSSI          = 11;
  static const uint16_t REG_WIFI_MODE     = 12;
  static const uint16_t REG_FW_VER        = 13;
  static const uint16_t REG_UPTIME        = 14;
  static const uint16_t REG_CMD           = 15;
  static const uint16_t REG_CMD_ARG       = 16;
  static const uint16_t REG_SESS_CNT_HI   = 18;
  static const uint16_t REG_SESS_CNT_LO   = 19;
  static const uint16_t REG_SESS_TOTAL_G  = 20;
  static const uint16_t REG_SESSION_MIN_G = 22;
  static const uint16_t REG_SESSION_MAX_G = 24;
  static const uint16_t REG_CLIENT_CONN   = 26;
  static const uint16_t REG_RESERVED_1    = 27;
  static const uint16_t REG_RESERVED_2    = 28;
  static const uint16_t REG_INTERCEPT     = 29;
  static const uint16_t NUM_REGS          = 31;

private:
  ModbusTCP      _mb;

  SharedState*   _shared        = nullptr;
  SettingsStore* _settings      = nullptr;

  bool    _started       = false;
  int8_t  _rssiCache     = -127;
  uint8_t _wifiModeCache = 0;

  void  putFloat(uint16_t offset, float val);
  float getFloat(uint16_t offset);
  void publish(int8_t rssi, uint8_t wifiMode);
};

#endif // MODBUS_SERVER_H