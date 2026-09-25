#ifndef MODBUS_SERVER_H
#define MODBUS_SERVER_H

// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter
//  ModbusServer — Modbus TCP server (port 502)
//
//  Uses ModbusTCP from emelianov/modbus-esp8266 @ 4.1.0.
//  ModbusTCP wraps WiFiServer/WiFiClient (correct class for ESP32 WiFi).
//  Do NOT use ModbusEthernet — that is for W5x00 hardware.
//
//  Holding-register map (Modbus addr = 40001 + offset):
//  Offset  Modbus  Words  Type     R/W  Description
//    0-1   40001   2      FLOAT32  R    Instantaneous weight (grams)
//    2-3   40003   2      FLOAT32  R    Stable (EMA) weight (grams)
//    4-5   40005   2      FLOAT32  R    Raw HX711 counts
//    6-7   40007   2      FLOAT32  R    Tare offset (counts)
//    8-9   40009   2      FLOAT32  R    Calibration slope (counts/kg)
//   10     40011   1      UINT16   R    Status flags (see below)
//   11     40012   1      INT16    R    RSSI dBm (0 if STA not connected)
//   12     40013   1      UINT16   R    WiFi mode (0=none,1=PSK,2=ENT)
//   13     40014   1      UINT16   R    Firmware version (major<<8|minor)
//   14     40015   1      UINT16   R    Uptime seconds (wraps at 65535)
//   15     40016   1      UINT16   R/W  Command register
//   16-17  40017   2      FLOAT32  R/W  Command argument (kg for calibrate)
//   18     40019   1      UINT16   R    Session count high word
//   19     40020   1      UINT16   R    Session count low word
//   20-21  40021   2      FLOAT32  R    Session total weight (grams)
//   22-23  40023   2      FLOAT32  R    Session min weight (grams)
//   24-25  40025   2      FLOAT32  R    Session max weight (grams)
//   26     40027   1      UINT16   R    Client connected (0/1)
//   27     40028   1      UINT16   R    Reserved (0)
//   28     40029   1      UINT16   R    Reserved (0)
//
//  Status flags (offset 10):
//    bit 0  0x0001  HX711 hardware ready (rawSample != 0)
//    bit 1  0x0002  Scale calibrated (countsPerKg valid)
//    bit 2  0x0004  STA WiFi connected (rssi > -127)
//    bit 3  0x0008  Command pending (not yet consumed)
//
//  Command codes (write to offset 15):
//    1  CMD_TARE           4  CMD_FLUSH
//    2  CMD_CALIBRATE     99  CMD_WIPE_WIFI
//    3  CMD_RESET_SESSION
// =====================================================================

#include <Arduino.h>
#include <ModbusTCP.h>
#include "SharedState.h"
#include "Settings.h"

class ModbusServer {
public:
  // Store shared-state and settings pointers.
  void begin(SharedState* shared, SettingsStore* settings);

  // Allocate all holding registers and start TCP listener on MODBUS_PORT.
  void startServer();

  // Poll Modbus stack + check command register. Call every MODBUS_POLL_MS.
  void loop();

  // Inject radio state before loop() so publish() can embed it.
  void setRuntime(int8_t rssi, uint8_t wifiMode);

  // True when at least one Modbus TCP client is tracked as connected.
  bool clientConnected();

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

  SharedState*   _shared        = nullptr;
  SettingsStore* _settings      = nullptr;

  bool    _started       = false;
  bool    _clientActive  = false;   // tracked via cbConnect / cbDisconnect
  int8_t  _rssiCache     = -127;
  uint8_t _wifiModeCache = 0;

  // Encode/decode float <-> two consecutive holding registers (big-endian).
  void  putFloat(uint16_t offset, float val);
  float getFloat(uint16_t offset);

  // Push all live values into the holding register bank.
  void publish(int8_t rssi, uint8_t wifiMode);

  // Connect/disconnect callbacks (static so they can be passed to library).
  static bool onClientConnect(IPAddress ip);
  static void onClientDisconnect(IPAddress ip);
};

#endif // MODBUS_SERVER_H
