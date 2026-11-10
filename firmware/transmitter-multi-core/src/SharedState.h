#ifndef SHARED_STATE_H
#define SHARED_STATE_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>

// Commands issued by the web portal / Modbus TCP (network core)
// and consumed by the scale task (sensor core).
enum ScaleCmd : uint8_t {
  CMD_NONE          = 0,
  CMD_TARE          = 1,   // zero the scale (current raw becomes offset)
  CMD_CALIBRATE     = 2,   // compute counts/kg using known weight (argF = kg)
  CMD_CALIBRATE_MLR = 5,   // apply pre-computed multi-point regression (argF = slope, argF2 = intercept)
  CMD_RESET_SESSION = 3,   // zero total / count / min / max
  CMD_FLUSH         = 4,   // force persist of session totals
  CMD_WIPE_WIFI     = 99,  // forget WiFi config + reboot into AP/setup
  CMD_CAPTURE_CAL_POINT = 6, // capture one calibration reference point (argF = kg, argF2 = expectedRaw)
  CMD_FINISH_CALIBRATION = 7, // compute regression from captured points and apply
  CMD_ZERO = 8    // capture zero point with empty platform (clears tare)
};

// Immutable-ish snapshot written by the scale task and read by the
// network task. Guarded by a Mutex so both cores never tear a field.
struct ScaleSnapshot {
  float rawSample;      // HX711 raw counts (offset subtracted)
  float weightG;        // instant weight (grams)
  float medianWeightG;  // spike-rejected weight (grams)
  float stableWeightG;  // low-pass filtered weight (grams)
  float noiseG;         // range of recent filtered samples (grams)
  float offsetCounts;   // tare offset (raw counts)
  float countsPerKg;    // calibration slope (counts per kg)
  float interceptCounts;// calibration intercept (raw counts at 0 kg)
  bool calibrated;     // countsPerKg has been set
  bool stable;          // recent samples remain within the stability range
  bool tareActive;      // a container tare is applied (RAM only, cleared on reboot)
  bool atZero;          // median weight is inside the center-of-zero lamp band
  uint16_t stableSampleCount;
};

struct CalibrationPoint {
  float weightKg;       // known reference weight (kg)
  float rawCounts;      // averaged HX711 raw counts at that weight
};

static const uint8_t MAX_CALIBRATION_POINTS = 8;

class SharedState {
public:
  void begin();

  // ---- scale task writes / network reads snapshot ----
  void setSnapshot(const ScaleSnapshot& s);
  ScaleSnapshot getSnapshot();

  // ---- network writes / scale task consumes command ----
  void requestCommand(ScaleCmd cmd, float argF = 0.0f, float argF2 = 0.0f);
  bool takeCommand(ScaleCmd& cmd, float& argF, float& argF2); // returns true if consumed
  bool commandPending();
  bool commandProcessing();        // true while scale task is executing a command handler
  void setCommandProcessing(bool v);

  // ---- session totals ----
  void setSessionTotals(uint32_t count, double totalG, double minG, double maxG);
  void getSessionTotals(uint32_t& count, double& totalG, double& minG, double& maxG);

  // ---- calibration points (multi-point regression) ----
  void resetCalibrationPoints();
  void addCalibrationPoint(float weightKg, float rawCounts);
  uint8_t calibrationPointCount() const;
  CalibrationPoint getCalibrationPoint(uint8_t index) const;
  bool computeLinearRegression(float& slope, float& intercept) const;

  // ---- boot time (ms) ----
  uint32_t uptimeSeconds();

private:
  SemaphoreHandle_t _mutex;

  ScaleSnapshot _snap;

  ScaleCmd _cmd;      float _cmdArg;   float _cmdArg2;   bool _cmdPending;
  bool     _commandProcessing = false;

  uint32_t _sessCount; double _totalG; double _minG; double _maxG;

  CalibrationPoint _calPoints[MAX_CALIBRATION_POINTS];
  uint8_t _calPointCount;
};

#endif // SHARED_STATE_H