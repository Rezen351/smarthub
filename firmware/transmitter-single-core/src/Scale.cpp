#include "Scale.h"
#include "Logger.h"
#include "config.h"

void ScaleSensor::begin(SharedState* shared, SettingsStore* settings) {
  _s = shared;
  _st = settings;

  _hx.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN, HX711_FAST_PROCESSOR, false);
  _hx.power_up();

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

static bool hxPoll(HX711& hx, int waitMs) {
  int waited = 0;
  while (!hx.is_ready()) {
    yield();
    if (++waited > waitMs) return false;
  }
  return true;
}

void ScaleSensor::loop() {
  uint32_t now = millis();
  if ((now - _lastSample) < SCALE_SAMPLE_MS) return;
  _lastSample = now;

  ScaleCmd cmd; float arg; float arg2;
  while (_s->takeCommand(cmd, arg, arg2)) {
    switch (cmd) {
      case CMD_TARE: {
        LOG_INFO("scale", "state=tare-start");
        if (hxPoll(_hx, 500)) {
          _hx.tare();
          ScaleSnapshot snap = _s->getSnapshot();
          snap.offsetCounts = (float)_hx.get_offset();
          snap.countsPerKg = 0.0f;
          snap.calibrated = false;
          _s->setSnapshot(snap);

          AppSettings a; _st->load(a);
          a.calOffset = snap.offsetCounts;
          a.countsPerKg = 0.0f;
          a.calibrated = false;
          _st->saveCalibration(a);
          LOG_INFO("scale", "state=tare-done");
        } else {
          LOG_INFO("scale", "state=tare-timeout");
        }
        break;
      }
      case CMD_CALIBRATE: {
        float kg = arg;
        LOG_INFO("scale", "state=calibrate-start ref=%.3f kg", kg);
        if (kg > 0.0f && hxPoll(_hx, 500)) {
          float raw = (float)_hx.get_value();
          float cPerKg = raw / kg;
          if (cPerKg > 0.0f) {
            applyCalibration(cPerKg, 0.0f);
            LOG_INFO("scale", "state=calibrate-done");
          } else {
            LOG_INFO("scale", "state=calibrate-invalid");
          }
        } else {
          LOG_INFO("scale", "state=calibrate-timeout");
        }
        break;
      }
      case CMD_CALIBRATE_MLR: {
        float slope = arg;
        float intercept = arg2;
        LOG_INFO("scale", "state=calibrate-mlr-start slope=%.4f intercept=%.4f",
                      slope, intercept);
        if (slope > 0.0f) {
          applyCalibration(slope, intercept);
          LOG_INFO("scale", "state=calibrate-mlr-done");
        } else {
          LOG_INFO("scale", "state=calibrate-mlr-invalid");
        }
        break;
      }
      case CMD_CAPTURE_CAL_POINT: {
        float weightKg = arg;
        float expectedRaw = arg2;
        LOG_INFO("scale", "state=capture-point-start kg=%.3f expected=%.1f",
                      weightKg, expectedRaw);
        if (weightKg > 0.0f && hxPoll(_hx, 500)) {
          float raw = (float)_hx.get_value();
          if (expectedRaw > 0.0f) {
            raw = expectedRaw;
          }
          _s->addCalibrationPoint(weightKg, raw);
          LOG_INFO("scale", "state=capture-point kg=%.3f counts=%.1f totalPoints=%d",
                        weightKg, raw, (int)_s->calibrationPointCount());
        } else {
          LOG_INFO("scale", "state=capture-point-timeout");
        }
        break;
      }
      case CMD_FINISH_CALIBRATION: {
        LOG_INFO("scale", "state=finish-calibration-start");
        float slope = 0.0f;
        float intercept = 0.0f;
        if (_s->computeLinearRegression(slope, intercept)) {
          LOG_INFO("scale", "state=finish-calibration slope=%.4f intercept=%.4f",
                        slope, intercept);
          applyCalibration(slope, intercept);
          LOG_INFO("scale", "state=finish-calibration-done");
        } else {
          LOG_INFO("scale", "state=finish-calibration-failed (need >=2 points)");
        }
        break;
      }
      case CMD_RESET_SESSION: {
        LOG_INFO("scale", "state=reset-session");
        _s->setSessionTotals(0, 0.0, 0.0, 0.0);
        AppSettings a; _st->load(a);
        a.totalG = 0.0; a.sampleCount = 0;
        _st->saveTotals(a.totalG, a.sampleCount);
        LOG_INFO("scale", "state=reset-session-done");
        break;
      }
      case CMD_FLUSH: {
        LOG_INFO("scale", "state=flush-session");
        uint32_t cnt; double tg, mn, mx;
        _s->getSessionTotals(cnt, tg, mn, mx);
        _st->saveTotals(tg, cnt);
        LOG_INFO("scale", "state=flush-done cnt=%u total=%.1f",
                      (unsigned)cnt, tg);
        break;
      }
      case CMD_WIPE_WIFI: {
        LOG_INFO("scale", "state=wipe-wifi");
        AppSettings a; _st->load(a);
        a.wifiMode = WIFI_MODE_NONE;
        a.ssid = ""; a.wpaPassword = ""; a.entIdentity = ""; a.entUsername = ""; a.entPassword = "";
        _st->saveWifi(a);
        LOG_INFO("scale", "state=wipe-wifi-done rebooting");
        delay(200);
        ESP.restart();
        break;
      }
      default:
        LOG_INFO("scale", "state=unknown-cmd cmd=%u", (unsigned)cmd);
        break;
    }
  }

  if (!hxPoll(_hx, 40)) return;

  float raw = (float)_hx.get_value();
  ScaleSnapshot snap = _s->getSnapshot();
  snap.rawSample = raw;

  if (snap.calibrated && snap.countsPerKg > 0.0f) {
    float instG = (raw - snap.interceptCounts) / snap.countsPerKg * 1000.0f;
    snap.weightG = instG;

    if (snap.stableWeightG == 0.0f && instG != 0.0f) {
      snap.stableWeightG = instG;
    } else {
      snap.stableWeightG = SCALE_ALPHA * instG + (1.0f - SCALE_ALPHA) * snap.stableWeightG;
    }

    float stable = snap.stableWeightG;
    if (stable > 5.0f) {
      uint32_t cnt; double tg, mn, mx;
      _s->getSessionTotals(cnt, tg, mn, mx);
      if (cnt == 0) { mn = stable; mx = stable; }
      else { if (stable < mn) mn = stable; if (stable > mx) mx = stable; }
      tg += (double)stable;
      cnt += 1;
      _s->setSessionTotals(cnt, tg, mn, mx);
    }
  }

  _s->setSnapshot(snap);

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
  _s->setSnapshot(snap);

  _st->saveCalibrationValues(slope, intercept, true);
  LOG_INFO("scale", "calibration applied countsPerKg=%.4f intercept=%.4f calibrated=%d",
                slope, intercept, snap.calibrated);
}