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
  _zeroCounts = (float)_hx.get_offset();   // zero point = current HX711 offset
  _tareCounts = 0.0f;                      // tare is RAM-only, cleared on boot

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
  _lastQuantizedG = 0.0f;
  _aztOffsetG = 0.0f;
  _lastAztMs = 0;
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

float ScaleSensor::quantizeWithHysteresis(float netG) {
  if (fabsf(netG) < SCALE_ZERO_SNAP_G) {
    _lastQuantizedG = 0.0f;
    return 0.0f;
  }

  float candidate = roundf(netG / SCALE_DIVISION_G) * SCALE_DIVISION_G;
  if (candidate != _lastQuantizedG) {
    float midpoint = (_lastQuantizedG + candidate) * 0.5f;
    if (candidate > _lastQuantizedG) {
      if (netG >= midpoint + SCALE_HYSTERESIS_G) {
        _lastQuantizedG = candidate;
      }
    } else {
      if (netG <= midpoint - SCALE_HYSTERESIS_G) {
        _lastQuantizedG = candidate;
      }
    }
  }

  if (fabsf(_lastQuantizedG) < (SCALE_DIVISION_G * 0.5f)) {
    _lastQuantizedG = 0.0f;
  }
  return _lastQuantizedG;
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
        if (_tareCapturePending) {
          LOG_WARN("scale", "tare request ignored: capture already in progress");
        } else {
          _tareCapturePending = true;
          _tareSampleCount = 0;
          _tareSampleSum = 0;
          LOG_INFO("scale", "tare capture started samples=%u", (unsigned)HX711_READS);
        }
        break;
      }
      case CMD_ZERO: {
        if (hxPoll(_hx, 500)) {
          _hx.tare(HX711_READS);                    // fast zero point = current raw average
          _zeroCounts = (float)_hx.get_offset();
          _tareCounts = 0.0f;                       // a fresh zero replaces any tare
          ScaleSnapshot snap = _s->getSnapshot();
          snap.offsetCounts = _zeroCounts;
          snap.interceptCounts = 0.0f;              // new zero aligns intercept to 0
          snap.tareActive = false;
          snap.atZero = true;
          snap.weightG = 0.0f;
          snap.medianWeightG = 0.0f;
          snap.stableWeightG = 0.0f;
          snap.noiseG = 0.0f;
          snap.stable = true;
          snap.stableSampleCount = 1;
          resetFilter();
          _s->setSnapshot(snap);
          AppSettings a; _st->load(a);
          a.calOffset = _zeroCounts;                // persist zero point, keep slope
          a.calIntercept = 0.0f;
          _st->saveCalibration(a);
          LOG_INFO("scale", "zero point captured offsetCounts=%.1f (ADC zeroed, tare cleared)", _zeroCounts);
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

  if (_tareCapturePending) {
    _tareSampleSum += (int64_t)raw;
    _tareSampleCount++;
    if (_tareSampleCount >= HX711_READS) {
      _tareCounts = (float)_tareSampleSum / (float)_tareSampleCount;
      _tareCapturePending = false;
      _tareSampleCount = 0;
      _tareSampleSum = 0;

      ScaleSnapshot tareSnap = _s->getSnapshot();
      tareSnap.tareActive = true;
      tareSnap.atZero = true;
      tareSnap.weightG = 0.0f;
      tareSnap.medianWeightG = 0.0f;
      tareSnap.stableWeightG = 0.0f;
      tareSnap.noiseG = 0.0f;
      tareSnap.stable = true;
      tareSnap.stableSampleCount = 1;
      resetFilter();
      _s->setSnapshot(tareSnap);
      LOG_INFO("scale", "tare applied tareCounts=%.1f counts (calibration kept)", _tareCounts);
    }
  }

  float netRaw = raw - _tareCounts;          // container tare excluded from weight

  ScaleSnapshot snap = _s->getSnapshot();
  snap.rawSample = raw;

  if (snap.calibrated && snap.countsPerKg > 0.0f) {
    float instG = (netRaw - snap.interceptCounts) / snap.countsPerKg * 1000.0f;
    snap.weightG = instG;
    snap.medianWeightG = medianWeight(instG);
    float filtered = filterWeight(snap.medianWeightG);
    snap.noiseG = filterNoise();

    // ---- Motion Detection & Stability Evaluation ----
    bool withinRange = snap.noiseG <= SCALE_STABILITY_RANGE_G &&
                       fabsf(snap.medianWeightG - filtered) <= SCALE_STABILITY_RANGE_G;
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

    // ---- Automatic Zero Tracking (AZT, stable-only) ----
#if SCALE_AZT_ENABLED
    if (snap.stable && fabsf(filtered) <= SCALE_AZT_BAND_G) {
      if (_lastAztMs == 0) _lastAztMs = now;
      uint32_t dtMs = now - _lastAztMs;
      _lastAztMs = now;
      if (dtMs > 0 && dtMs < 1000) {
        float maxStep = (SCALE_AZT_RATE_G_PER_S * (float)dtMs) / 1000.0f;
        float diff = filtered - _aztOffsetG;
        if (fabsf(diff) <= maxStep) {
          _aztOffsetG = filtered;
        } else if (diff > 0.0f) {
          _aztOffsetG += maxStep;
        } else {
          _aztOffsetG -= maxStep;
        }
      }
    } else {
      _lastAztMs = now;
    }
#endif

    float netG = filtered - _aztOffsetG;

    // ---- Hysteresis Quantization & Center-of-Zero Snap ----
    snap.stableWeightG = quantizeWithHysteresis(netG);

    snap.atZero = fabsf(snap.stableWeightG) <= SCALE_ZERO_LAMP_BAND_G;
    snap.tareActive = (_tareCounts != 0.0f);

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
