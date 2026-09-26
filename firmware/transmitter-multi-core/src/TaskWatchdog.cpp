#include "TaskWatchdog.h"
#include "config.h"
#include "Logger.h"

bool TaskWatchdog::_initialized = false;
TaskHandle_t TaskWatchdog::_watchdogTask = nullptr;
uint32_t TaskWatchdog::_lastFeedMs[4] = {0};
uint32_t TaskWatchdog::_timeoutMs[4] = {0};
const char* TaskWatchdog::_name[4] = {nullptr};
uint8_t TaskWatchdog::_count = 0;

static void watchdogTask(void* pvParameters) {
  for (;;) {
    TaskWatchdog::loop();
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}

void TaskWatchdog::init() {
  if (_initialized) return;
  _initialized = true;

  xTaskCreate(watchdogTask, "watchdog", 2048, nullptr, 3, &_watchdogTask);
  LOG_INFO("[watchdog] initialized");
}

void TaskWatchdog::feed(const char* name, uint32_t timeoutMs) {
  for (uint8_t i = 0; i < _count; i++) {
    if (_name[i] == name) {
      _lastFeedMs[i] = millis();
      _timeoutMs[i] = timeoutMs;
      return;
    }
  }

  if (_count < 4) {
    uint8_t idx = _count++;
    _name[idx] = name;
    _lastFeedMs[idx] = millis();
    _timeoutMs[idx] = timeoutMs;
    LOG_INFO("[watchdog] registered task '%s' timeout=%u ms", name, (unsigned)timeoutMs);
  }
}

void TaskWatchdog::loop() {
  uint32_t now = millis();
  for (uint8_t i = 0; i < _count; i++) {
    if (_timeoutMs[i] > 0 && (now - _lastFeedMs[i]) > _timeoutMs[i]) {
      LOG_ERROR("[watchdog] CRITICAL: task '%s' hung for %u ms, rebooting",
                    _name[i], (unsigned)(now - _lastFeedMs[i]));
      delay(100);
      ESP.restart();
    }
  }
}
