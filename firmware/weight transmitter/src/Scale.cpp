#include "Scale.h"
#include "config.h"

void ScaleSensor::begin(SharedState* shared, SettingsStore* settings) {
  _s = shared;
  _st = settings;

  _hx.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN, HX711_FAST_PROCESSOR);
  _hx.power_up();

  // Restore calibration from NVS.
  AppSettings persisted;
  _st->load(persisted);

  if (persisted.calOffset != 0.0f || persisted.calibrated) {
    _hx.set_offset((int32_t)persisted.calOffset);
  }

  ScaleSnapshot snap = _s->getSnapshot();
  snap.offsetCounts = persisted.calOffset;
  snap.countsPerKg  = persisted.countsPerKg;
  snap.interceptCounts = persisted.calIntercept;
  snap.calibrated   = persisted.calibrated;
  _s->setSnapshot(snap);
}

// Returns true once the HX711 has produced a datum.
static bool hxPoll(HX711& hx, int waitMs) {
  int waited = 0;
  while (!hx.is_ready()) {
    delay(1);
    if (++waited > waitMs) return false;
  }
  return true;
}

void ScaleSensor::loop() {
  uint32_t now = millis();
  if ((now - _lastSample) < SCALE_SAMPLE_MS) return;
  _lastSample = now;

  // ---- consume commands issued by web / modbus ----
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
          Serial.printf("[scale] CMD_CALIBRATE_MLR slope=%.4f intercept=%.4f\n", slope, intercept);
          applyCalibration(slope, intercept);
        } else {
          Serial.println("[scale] CMD_CALIBRATE_MLR ignored: slope <= 0");
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

  // ---- acquire a fresh reading ----
  if (!hxPoll(_hx, 40)) return;              // HX711 not responding yet

  float raw = (float)_hx.get_value();        // offset-subtracted counts

  ScaleSnapshot snap = _s->getSnapshot();
  snap.rawSample = raw;

  if (snap.calibrated && snap.countsPerKg > 0.0f) {
    float instG = (raw - snap.interceptCounts) / snap.countsPerKg * 1000.0f;
    snap.weightG = instG;

    // First reading initialises the filter state.
    if (snap.stableWeightG == 0.0f && instG != 0.0f) {
      snap.stableWeightG = instG;
    } else {
      snap.stableWeightG = SCALE_ALPHA * instG + (1.0f - SCALE_ALPHA) * snap.stableWeightG;
    }

    // Accumulate session totals only from (near-)stable positive mass.
    float stable = snap.stableWeightG;
    if (stable > 5.0f) {
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
  _s->setSnapshot(snap);

  AppSettings a;
  _st->load(a);
  a.countsPerKg = slope;
  a.calIntercept = intercept;
  a.calibrated = true;
  _st->saveCalibration(a);
}