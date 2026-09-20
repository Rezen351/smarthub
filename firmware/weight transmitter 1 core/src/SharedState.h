#ifndef SHARED_STATE_H
#define SHARED_STATE_H

#include <Arduino.h>

// Commands issued by the web portal / Modbus TCP
// and consumed by the scale loop.
enum ScaleCmd : uint8_t {
  CMD_NONE          = 0,
  CMD_TARE          = 1,   // zero the scale (current raw becomes offset)
  CMD_CALIBRATE     = 2,   // compute counts/kg using known weight (argF = kg)
  CMD_CALIBRATE_MLR = 5,   // apply pre-computed multi-point regression (argF = slope, argF2 = intercept)
  CMD_RESET_SESSION = 3,   // zero total / count / min / max
  CMD_FLUSH         = 4,   // force persist of session totals
  CMD_WIPE_WIFI     = 99   // forget WiFi config + reboot into AP/setup
};

// Immutable-ish snapshot written by the scale loop and read by the
// network handlers. No mutex needed on single core.
struct ScaleSnapshot {
  float rawSample;      // HX711 raw counts (offset subtracted)
  float weightG;        // instant weight (grams)
  float stableWeightG;  // low-pass filtered weight (grams)
  float offsetCounts;   // tare offset (raw counts)
  float countsPerKg;    // calibration slope (counts per kg)
  float interceptCounts;// calibration intercept (raw counts at 0 kg)
  bool  calibrated;     // countsPerKg has been set
};

class SharedState {
public:
  void begin();

  // ---- scale loop writes / network reads snapshot ----
  void setSnapshot(const ScaleSnapshot& s);
  ScaleSnapshot getSnapshot();

  // ---- network writes / scale loop consumes command ----
  void requestCommand(ScaleCmd cmd, float argF = 0.0f, float argF2 = 0.0f);
  bool takeCommand(ScaleCmd& cmd, float& argF, float& argF2); // returns true if consumed
  bool commandPending();

  // ---- session totals ----
  void setSessionTotals(uint32_t count, double totalG, double minG, double maxG);
  void getSessionTotals(uint32_t& count, double& totalG, double& minG, double& maxG);

  // ---- boot time (ms) ----
  uint32_t uptimeSeconds();

private:
  ScaleSnapshot _snap;

  ScaleCmd _cmd;      float _cmdArg;   float _cmdArg2;   bool _cmdPending;

  uint32_t _sessCount; double _totalG; double _minG; double _maxG;
};

#endif // SHARED_STATE_H