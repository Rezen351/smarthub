#ifndef DEEP_SLEEP_H
#define DEEP_SLEEP_H

#include <Arduino.h>

class DeepSleep {
 public:
  static void begin() {
#if DEEP_SLEEP_ENABLED
    // Configure wake-up sources here when deep sleep is enabled.
#endif
  }

  static void maybeSleep() {
#if DEEP_SLEEP_ENABLED
    // Enter deep sleep between measurements when on battery power.
    // Wake on timer or HX711 data-ready interrupt.
#endif
  }
};

#endif
