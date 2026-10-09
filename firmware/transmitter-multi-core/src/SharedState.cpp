#include "SharedState.h"
#include "config.h"

void SharedState::begin() {
  _mutex = xSemaphoreCreateMutex();
  _snap.rawSample = 0.0f;
  _snap.weightG = 0.0f;
  _snap.medianWeightG = 0.0f;
  _snap.stableWeightG = 0.0f;
  _snap.noiseG = 0.0f;
  _snap.offsetCounts = 0.0f;
  _snap.countsPerKg = 0.0f;
  _snap.interceptCounts = 0.0f;
  _snap.calibrated = false;
  _snap.stable = false;
  _snap.stableSampleCount = 0;
  _cmd = CMD_NONE;
  _cmdArg = 0.0f;
  _cmdArg2 = 0.0f;
  _cmdPending = false;
  _commandProcessing = false;
  _sessCount = 0;
  _totalG = 0.0;
  _minG = 0.0;
  _maxG = 0.0;
  _calPointCount = 0;
}

void SharedState::setSnapshot(const ScaleSnapshot& s) {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  _snap = s;
  if (_mutex) xSemaphoreGive(_mutex);
}

ScaleSnapshot SharedState::getSnapshot() {
  ScaleSnapshot s;
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  s = _snap;
  if (_mutex) xSemaphoreGive(_mutex);
  return s;
}

void SharedState::requestCommand(ScaleCmd cmd, float argF, float argF2) {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  _cmd = cmd;
  _cmdArg = argF;
  _cmdArg2 = argF2;
  _cmdPending = true;
  if (_mutex) xSemaphoreGive(_mutex);
}

bool SharedState::takeCommand(ScaleCmd& cmd, float& argF, float& argF2) {
  bool got = false;
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  if (_cmdPending) {
    cmd = _cmd; argF = _cmdArg; argF2 = _cmdArg2;
    _cmdPending = false;
    got = true;
  }
  if (_mutex) xSemaphoreGive(_mutex);
  return got;
}

bool SharedState::commandPending() {
  bool p = false;
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  p = _cmdPending;
  if (_mutex) xSemaphoreGive(_mutex);
  return p;
}

bool SharedState::commandProcessing() {
  bool p = false;
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  p = _commandProcessing;
  if (_mutex) xSemaphoreGive(_mutex);
  return p;
}

void SharedState::setCommandProcessing(bool v) {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  _commandProcessing = v;
  if (_mutex) xSemaphoreGive(_mutex);
}

void SharedState::setSessionTotals(uint32_t count, double totalG, double minG, double maxG) {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  _sessCount = count; _totalG = totalG; _minG = minG; _maxG = maxG;
  if (_mutex) xSemaphoreGive(_mutex);
}

void SharedState::getSessionTotals(uint32_t& count, double& totalG, double& minG, double& maxG) {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  count = _sessCount; totalG = _totalG; minG = _minG; maxG = _maxG;
  if (_mutex) xSemaphoreGive(_mutex);
}

uint32_t SharedState::uptimeSeconds() {
  return (uint32_t)(millis() / 1000);
}

void SharedState::resetCalibrationPoints() {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  _calPointCount = 0;
  if (_mutex) xSemaphoreGive(_mutex);
}

void SharedState::addCalibrationPoint(float weightKg, float rawCounts) {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  if (_calPointCount < MAX_CALIBRATION_POINTS) {
    _calPoints[_calPointCount].weightKg = weightKg;
    _calPoints[_calPointCount].rawCounts = rawCounts;
    _calPointCount++;
  }
  if (_mutex) xSemaphoreGive(_mutex);
}

uint8_t SharedState::calibrationPointCount() const {
  uint8_t c = 0;
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  c = _calPointCount;
  if (_mutex) xSemaphoreGive(_mutex);
  return c;
}

CalibrationPoint SharedState::getCalibrationPoint(uint8_t index) const {
  CalibrationPoint p = {0.0f, 0.0f};
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  if (index < _calPointCount) {
    p = _calPoints[index];
  }
  if (_mutex) xSemaphoreGive(_mutex);
  return p;
}

bool SharedState::computeLinearRegression(float& slope, float& intercept) const {
  if (_mutex) xSemaphoreTake(_mutex, portMAX_DELAY);
  if (_calPointCount < 2) {
    if (_mutex) xSemaphoreGive(_mutex);
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

  bool ok = false;
  if (fabs(denom) >= 1e-6) {
    slope = (float)((n * sumXY - sumX * sumY) / denom);
    intercept = (float)((sumY - slope * sumX) / n);
    ok = slope > 0.0f;
  }

  if (_mutex) xSemaphoreGive(_mutex);
  return ok;
}