#include "Scale.h"
#include "config.h"
#include "Logger.h"
#include <math.h>

void ScaleSensor::begin(SharedState* shared, SettingsStore* settings) {
  _s = shared;
  _st = settings;

  _hx.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN, HX711_FAST_PROCESSOR, false);
  _hx.power_up();
  resetFilter();

  AppSettings persisted;
  _st->load(persisted);

  if (persisted.calOffset != 0.0f || persisted.calibrated) {
    _hx.set_offset((int32_t)persisted.calOffset);
  }

  ScaleSnapshot snap = _s->getSnapshot();
  snap.offsetCounts = persisted.calOffset;
  snap.countsPerKg = persisted.countsPerKg;
  snap.interceptCounts = persisted.calIntercept;
  snap.calibrated = persisted.calibrated;
  _s->setSnapshot(snap);

  for (uint8_t i = 0; i < persisted.calPointCount; i++) {
    _s->addCalibrationPoint(persisted.calPointWeightKg[i], persisted.calPointRawCounts[i]);
  }

  LOG_INFO("scale", "HX711 initialised, calibration loaded from NVS");
}

// Returns true once the HX711 has produced a datum.
static bool hxPoll(HX711& hx, int waitMs) {
  int waited = 0;
  while (!hx.is_ready()) {
    yield();
    if (++waited > waitMs) return false;
  }
  return true;
}

void ScaleSensor::resetFilter() {
  _medianCount = 0;
  _medianIndex = 0;
  _filterCount = 0;
  _filterIndex = 0;
  _filterInitialized = false;
  _stableSince = 0;
  _stableSampleCount = 0;
  for (uint8_t i = 0; i < SCALE_MEDIAN_WINDOW; i++) {
    _medianHistory[i] = 0.0f;
  }
  for (uint8_t i = 0; i < SCALE_FILTER_WINDOW; i++) {
    _filterHistory[i] = 0.0f;
  }
}

float ScaleSensor::medianWeight(float value) {
  _medianHistory[_medianIndex] = value;
  _medianIndex = (uint8_t)((_medianIndex + 1) % SCALE_MEDIAN_WINDOW);
  if (_medianCount < SCALE_MEDIAN_WINDOW) {
    _medianCount++;
  }

  float sorted[SCALE_MEDIAN_WINDOW];
  for (uint8_t i = 0; i < _medianCount; i++) {
    sorted[i] = _medianHistory[i];
  }
  for (uint8_t i = 1; i < _medianCount; i++) {
    float current = sorted[i];
    uint8_t j = i;
    while (j > 0 && sorted[j - 1] > current) {
      sorted[j] = sorted[j - 1];
      j--;
    }
    sorted[j] = current;
  }
  return sorted[_medianCount / 2];
}

float ScaleSensor::filterWeight(float median) {
  float filtered = median;
  if (_filterInitialized) {
    float delta = fabsf(median - _filterHistory[(_filterIndex + SCALE_FILTER_WINDOW - 1) % SCALE_FILTER_WINDOW]);
    float alpha = delta >= SCALE_CHANGE_THRESHOLD_G ? SCALE_FAST_ALPHA : SCALE_SLOW_ALPHA;
    filtered = alpha * median + (1.0f - alpha) *
      _filterHistory[(_filterIndex + SCALE_FILTER_WINDOW - 1) % SCALE_FILTER_WINDOW];
  } else {
    _filterInitialized = true;
  }

  _filterHistory[_filterIndex] = filtered;
  _filterIndex = (uint8_t)((_filterIndex + 1) % SCALE_FILTER_WINDOW);
  if (_filterCount < SCALE_FILTER_WINDOW) {
    _filterCount++;
  }
  return filtered;
}

float ScaleSensor::filterNoise() const {
  if (_filterCount == 0) return 0.0f;
  float minimum = _filterHistory[0];
  float maximum = _filterHistory[0];
  for (uint8_t i = 1; i < _filterCount; i++) {
    if (_filterHistory[i] < minimum) minimum = _filterHistory[i];
    if (_filterHistory[i] > maximum) maximum = _filterHistory[i];
  }
  return maximum - minimum;
}

void ScaleSensor::loop() {
  uint32_t now = millis();
  if ((now - _lastSample) < SCALE_SAMPLE_MS) return;
  _lastSample = now;

  // ---- consume commands issued by web / modbus ----
  _s->setCommandProcessing(true);
  ScaleCmd cmd; float arg; float arg2;
  while (_s->takeCommand(cmd, arg, arg2)) {
    switch (cmd) {
      case CMD_TARE: {
        if (hxPoll(_hx, 500)) {
          _hx.tare();                       // sets offset to current raw
          ScaleSnapshot snap = _s->getSnapshot();
          snap.offsetCounts = (float)_hx.get_offset();
          snap.countsPerKg = 0.0f;          // calibration invalid after re-zero
          snap.calibrated = false;
          snap.medianWeightG = 0.0f;
          snap.stableWeightG = 0.0f;
          snap.noiseG = 0.0f;
          snap.stable = false;
          snap.stableSampleCount = 0;
          resetFilter();
          _s->setSnapshot(snap);

          AppSettings a; _st->load(a);
          a.calOffset = snap.offsetCounts;
          a.countsPerKg = 0.0f;
          a.calibrated = false;
          _st->saveCalibration(a);
        }
        break;
      }
      case CMD_CALIBRATE: {
        float kg = arg;
        if (kg > 0.0f && hxPoll(_hx, 500)) {
          float raw = (float)_hx.get_value();   // offset already subtracted
          float cPerKg = raw / kg;
          if (cPerKg > 0.0f) {
            applyCalibration(cPerKg, 0.0f);
          }
        }
        break;
      }
      case CMD_CALIBRATE_MLR: {
        float slope = arg;
        float intercept = arg2;
        if (slope > 0.0f) {
          LOG_INFO("scale", "CMD_CALIBRATE_MLR countsPerKg=%.4f intercept=%.4f", slope, intercept);
          applyCalibration(slope, intercept);
        } else {
          LOG_WARN("scale", "CMD_CALIBRATE_MLR ignored: slope <= 0");
        }
        break;
      }
      case CMD_CAPTURE_CAL_POINT: {
        float weightKg = arg;
        float expectedRaw = arg2;
        if (weightKg > 0.0f && hxPoll(_hx, 500)) {
          float raw = (float)_hx.get_value();
          if (expectedRaw > 0.0f) {
            raw = expectedRaw;
          }
          _s->addCalibrationPoint(weightKg, raw);
          LOG_INFO("scale", "CMD_CAPTURE_CAL_POINT captured %.3f kg -> %.1f counts (total points: %d)",
                        weightKg, raw, (int)_s->calibrationPointCount());
        }
        break;
      }
      case CMD_FINISH_CALIBRATION: {
        float slope = 0.0f;
        float intercept = 0.0f;
        if (_s->computeLinearRegression(slope, intercept)) {
          LOG_INFO("scale", "CMD_FINISH_CALIBRATION computed slope=%.4f intercept=%.4f", slope, intercept);
          applyCalibration(slope, intercept);
        } else {
          LOG_WARN("scale", "CMD_FINISH_CALIBRATION ignored: need at least 2 points with non-zero slope");
        }
        break;
      }
      case CMD_RESET_SESSION: {
        _s->setSessionTotals(0, 0.0, 0.0, 0.0);
        AppSettings a; _st->load(a);
        a.totalG = 0.0; a.sampleCount = 0;
        _st->saveTotals(a.totalG, a.sampleCount);
        break;
      }
      case CMD_FLUSH: {
        uint32_t cnt; double tg, mn, mx;
        _s->getSessionTotals(cnt, tg, mn, mx);
        _st->saveTotals(tg, cnt);
        break;
      }
      case CMD_WIPE_WIFI: {
        AppSettings a; _st->load(a);
        a.wifiMode = WIFI_MODE_NONE;
        a.ssid = ""; a.wpaPassword = ""; a.entIdentity = ""; a.entUsername = ""; a.entPassword = "";
        _st->saveWifi(a);
        delay(200);
        ESP.restart();
        break;
      }
      default:
        break;
    }
  }
  _s->setCommandProcessing(false);

  // ---- acquire a fresh reading ----
  if (!hxPoll(_hx, 40)) return;              // HX711 not responding yet

  float raw = (float)_hx.get_value();        // offset-subtracted counts

  ScaleSnapshot snap = _s->getSnapshot();
  snap.rawSample = raw;

  if (snap.calibrated && snap.countsPerKg > 0.0f) {
    float instG = (raw - snap.interceptCounts) / snap.countsPerKg * 1000.0f;
    snap.weightG = instG;
    snap.medianWeightG = medianWeight(instG);
    snap.stableWeightG = filterWeight(snap.medianWeightG);
    snap.noiseG = filterNoise();

    bool withinRange = snap.noiseG <= SCALE_STABILITY_RANGE_G &&
                       fabsf(snap.medianWeightG - snap.stableWeightG) <= SCALE_STABILITY_RANGE_G;
    if (withinRange) {
      if (_stableSince == 0) _stableSince = now;
      if ((now - _stableSince) >= SCALE_STABILITY_HOLD_MS) {
        snap.stable = true;
        if (_stableSampleCount < 65535U) _stableSampleCount++;
      }
    } else {
      _stableSince = 0;
      _stableSampleCount = 0;
      snap.stable = false;
    }
    snap.stableSampleCount = _stableSampleCount;

    // Accumulate session totals only from stable positive mass.
    float stable = snap.stableWeightG;
    if (snap.stable && stable > 5.0f) {
      uint32_t cnt; double tg, mn, mx;
      _s->getSessionTotals(cnt, tg, mn, mx);
      if (cnt == 0) { mn = stable; mx = stable; }
      else { if (stable < mn) mn = stable; if (stable > mx) mx = stable; }
      // This is a running total of sampled stable mass (kg-seconds -> kg approx).
      tg += (double)stable;
      cnt += 1;
      _s->setSessionTotals(cnt, tg, mn, mx);
    }
  }

  _s->setSnapshot(snap);

  // Persist totals periodically so data survives reboot.
  if ((now - _lastPersist) >= 30000) {
    _lastPersist = now;
    uint32_t cnt; double tg, mn, mx;
    _s->getSessionTotals(cnt, tg, mn, mx);
    _st->saveTotals(tg, cnt);
  }
}

void ScaleSensor::applyCalibration(float slope, float intercept) {
  ScaleSnapshot snap = _s->getSnapshot();
  snap.countsPerKg = slope;
  snap.interceptCounts = intercept;
  snap.calibrated = true;
  snap.medianWeightG = 0.0f;
  snap.stableWeightG = 0.0f;
  snap.noiseG = 0.0f;
  snap.stable = false;
  snap.stableSampleCount = 0;
  resetFilter();
  _s->setSnapshot(snap);

  // Persist only the calibration math: the tare offset stays untouched so a
  // concurrent portal write can never be overwritten with a stale copy.
  _st->saveCalibrationValues(slope, intercept, true);
  LOG_INFO("scale", "calibration applied countsPerKg=%.4f intercept=%.4f calibrated=%d",
            slope, intercept, snap.calibrated);
}