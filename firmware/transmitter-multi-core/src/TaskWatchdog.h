#ifndef TASK_WATCHDOG_H
#define TASK_WATCHDOG_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

class TaskWatchdog {
 public:
  static void init();
  static void feed(const char* name, uint32_t timeoutMs);
  static void loop();

 private:
  static bool _initialized;
  static TaskHandle_t _watchdogTask;
  static uint32_t _lastFeedMs[4];
  static uint32_t _timeoutMs[4];
  static const char* _name[4];
  static uint8_t _count;
};

#endif
