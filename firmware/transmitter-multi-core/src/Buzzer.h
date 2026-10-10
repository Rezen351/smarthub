#pragma once

#include <Arduino.h>
#include "config.h"

#if BUZZER_ENABLED

// Passive piezo buzzer (GPIO 47, ESP32-S3 only) driven by LEDC PWM.
// The whole engine is non-blocking: play() only requests a pattern and
// update() advances one step per call, so it never stalls networkTask.

class Buzzer {
 public:
    enum class Pattern : uint8_t { Startup, Press, Error, Confirm, SelfTest };

  void begin(uint8_t pin);
  void play(Pattern pattern);   // request a pattern; latest request wins
  void stop();                  // cancel the active/pending pattern and silence
  void update();                // non-blocking step sequencer
  bool busy() const { return _active || _pending != 0xFF; }

 private:
  struct Step { uint16_t onMs; uint16_t offMs; };
  static constexpr uint8_t MAX_STEPS = 20;

  Step     _steps[MAX_STEPS];
  uint8_t  _stepCount = 0;
  uint8_t  _step = 0;
  uint32_t _stepStartMs = 0;
  bool     _sounding = false;
  bool     _active = false;
  uint8_t _pin = 0;

  volatile uint8_t _pending = 0xFF;   // Pattern + 1, 0xFF = none
  void loadPattern(Pattern pattern);
  void silence();
};

#endif // BUZZER_ENABLED
