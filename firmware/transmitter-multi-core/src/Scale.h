#ifndef SCALE_H
#define SCALE_H

#include <Arduino.h>
#include "HX711.h"
#include "SharedState.h"
#include "Settings.h"
#include "config.h"

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
  float          _medianHistory[SCALE_MEDIAN_WINDOW] = {};
  uint8_t        _medianCount = 0;
  uint8_t        _medianIndex = 0;
  float          _filterHistory[SCALE_FILTER_WINDOW] = {};
  uint8_t        _filterCount = 0;
  uint8_t        _filterIndex = 0;
  bool           _filterInitialized = false;
  uint32_t       _stableSince = 0;
  uint16_t       _stableSampleCount = 0;
  float          _zeroCounts = 0.0f;   // persisted zero point (HX711 offset)
  float          _tareCounts = 0.0f;   // container tare (RAM only, not persisted)

  void applyCalibration(float slope, float intercept);
  void resetFilter();
  float medianWeight(float value);
  float filterWeight(float median);
  float filterNoise() const;
};

#endif // SCALE_H