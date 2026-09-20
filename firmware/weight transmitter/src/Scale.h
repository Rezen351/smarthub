#ifndef SCALE_H
#define SCALE_H

#include <Arduino.h>
#include "HX711.h"
#include "SharedState.h"
#include "Settings.h"

// Load-cell acquisition + calibration math. Runs on the sensor core.
class ScaleSensor {
public:
  void begin(SharedState* shared, SettingsStore* settings);

  // One iteration of the sensor task; call periodically.
  void loop();

  bool hxReady() { return _hwReady; }

 private:
  SharedState*   _s;
  SettingsStore* _st;
  HX711          _hx;
  bool           _hwReady = false;
  uint32_t       _lastSample = 0;
  uint32_t       _lastPersist = 0;

  void applyCalibration(float slope, float intercept);
};

#endif // SCALE_H