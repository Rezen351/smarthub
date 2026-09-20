#include "SharedState.h"
#include "config.h"

void SharedState::begin() {
  _snap.rawSample = 0.0f;
  _snap.weightG = 0.0f;
  _snap.stableWeightG = 0.0f;
  _snap.offsetCounts = 0.0f;
  _snap.countsPerKg = 0.0f;
  _snap.interceptCounts = 0.0f;
  _snap.calibrated = false;
  _cmd = CMD_NONE;
  _cmdArg = 0.0f;
  _cmdArg2 = 0.0f;
  _cmdPending = false;
  _sessCount = 0;
  _totalG = 0.0;
  _minG = 0.0;
  _maxG = 0.0;
  _calPointCount = 0;
}

void SharedState::setSnapshot(const ScaleSnapshot& s) {
  _snap = s;
}

ScaleSnapshot SharedState::getSnapshot() {
  return _snap;
}

void SharedState::requestCommand(ScaleCmd cmd, float argF, float argF2) {
  _cmd = cmd;
  _cmdArg = argF;
  _cmdArg2 = argF2;
  _cmdPending = true;
}

bool SharedState::takeCommand(ScaleCmd& cmd, float& argF, float& argF2) {
  bool got = false;
  if (_cmdPending) {
    cmd = _cmd; argF = _cmdArg; argF2 = _cmdArg2;
    _cmdPending = false;
    got = true;
  }
  return got;
}

bool SharedState::commandPending() {
  return _cmdPending;
}

void SharedState::setSessionTotals(uint32_t count, double totalG, double minG, double maxG) {
  _sessCount = count; _totalG = totalG; _minG = minG; _maxG = maxG;
}

void SharedState::getSessionTotals(uint32_t& count, double& totalG, double& minG, double& maxG) {
  count = _sessCount; totalG = _totalG; minG = _minG; maxG = _maxG;
}

uint32_t SharedState::uptimeSeconds() {
  return (uint32_t)(millis() / 1000);
}

void SharedState::resetCalibrationPoints() {
  _calPointCount = 0;
}

void SharedState::addCalibrationPoint(float weightKg, float rawCounts) {
  if (_calPointCount < MAX_CALIBRATION_POINTS) {
    _calPoints[_calPointCount].weightKg = weightKg;
    _calPoints[_calPointCount].rawCounts = rawCounts;
    _calPointCount++;
  }
}

uint8_t SharedState::calibrationPointCount() const {
  return _calPointCount;
}

SharedState::CalibrationPoint SharedState::getCalibrationPoint(uint8_t index) const {
  CalibrationPoint p = {0.0f, 0.0f};
  if (index < _calPointCount) {
    p = _calPoints[index];
  }
  return p;
}

bool SharedState::computeLinearRegression(float& slope, float& intercept) const {
  if (_calPointCount < 2) {
    return false;
  }

  double sumX = 0.0;
  double sumY = 0.0;
  double sumXY = 0.0;
  double sumX2 = 0.0;

  for (uint8_t i = 0; i < _calPointCount; i++) {
    double x = (double)_calPoints[i].weightKg;
    double y = (double)_calPoints[i].rawCounts;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  double n = (double)_calPointCount;
  double denom = n * sumX2 - sumX * sumX;

  if (fabs(denom) < 1e-6) {
    return false;
  }

  slope = (float)((n * sumXY - sumX * sumY) / denom);
  intercept = (float)((sumY - slope * sumX) / n);

  return slope > 0.0f;
}