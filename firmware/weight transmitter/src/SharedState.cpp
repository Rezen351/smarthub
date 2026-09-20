#include "SharedState.h"
#include "config.h"

void SharedState::begin() {
  _mutex = xSemaphoreCreateMutex();
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