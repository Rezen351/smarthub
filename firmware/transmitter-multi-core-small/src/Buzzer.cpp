#include "Buzzer.h"
#include "Logger.h"

#if BUZZER_ENABLED

void Buzzer::begin(uint8_t pin) {
  _pin = pin;
  pinMode(_pin, OUTPUT);
  digitalWrite(_pin, LOW);
  ledcSetup(BUZZER_LEDC_CHANNEL, BUZZER_FREQ_HZ, BUZZER_RESOLUTION_BITS);
  ledcAttachPin(_pin, BUZZER_LEDC_CHANNEL);
  silence();
  LOG_INFO("buzzer", "buzzer ready pin=%u freq=%u Hz duty=%u",
           (unsigned)_pin, (unsigned)BUZZER_FREQ_HZ, (unsigned)BUZZER_DUTY_ON);
}

void Buzzer::play(Pattern pattern) {
  // Volatile single-byte store: safe from any core/context, only the
  // latest request survives, so patterns never queue up.
  _pending = static_cast<uint8_t>(pattern) + 1;
}

void Buzzer::stop() {
  _pending = 0xFF;
  _active = false;
  _stepCount = 0;
  silence();
}

void Buzzer::silence() {
  ledcWrite(BUZZER_LEDC_CHANNEL, 0);
  _sounding = false;
}

void Buzzer::loadPattern(Pattern pattern) {
  _stepCount = 0;
  switch (pattern) {
    case Pattern::Startup:
      _steps[_stepCount++] = {BUZZER_STARTUP_BEEP_MS, BUZZER_STARTUP_GAP_MS};
      _steps[_stepCount++] = {BUZZER_STARTUP_BEEP_MS, 0};
      break;

    case Pattern::Press:
      _steps[_stepCount++] = {BUZZER_PRESS_MS, 0};
      break;

    case Pattern::Error: {
      for (uint8_t i = 0; i < BUZZER_ERROR_REPEAT; ++i) {
        Step step;
        step.onMs = BUZZER_ERROR_BEEP_MS;
        step.offMs = (i + 1 < BUZZER_ERROR_REPEAT) ? BUZZER_ERROR_GAP_MS : 0;
        _steps[_stepCount++] = step;
      }
      break;
    }

    case Pattern::Confirm:
      // Two short beeps plus one long beep: the preset-save confirmation.
      _steps[_stepCount++] = {BUZZER_CONFIRM_BEEP_MS, BUZZER_CONFIRM_GAP_MS};
      _steps[_stepCount++] = {BUZZER_CONFIRM_BEEP_MS, BUZZER_CONFIRM_GAP_MS};
      _steps[_stepCount++] = {BUZZER_CONFIRM_LONG_MS, 0};
      break;

    case Pattern::SelfTest:
      // Startup pattern.
      _steps[_stepCount++] = {BUZZER_STARTUP_BEEP_MS, BUZZER_STARTUP_GAP_MS};
      _steps[_stepCount++] = {BUZZER_STARTUP_BEEP_MS, 0};
      // Silence before the press click.
      _steps[_stepCount++] = {0, BUZZER_SELFTEST_GAP_MS};
      // Press click.
      _steps[_stepCount++] = {BUZZER_PRESS_MS, 0};
      // Silence before the error pattern.
      _steps[_stepCount++] = {0, BUZZER_SELFTEST_GAP_MS};
      // Error pattern.
      _steps[_stepCount++] = {BUZZER_ERROR_BEEP_MS, BUZZER_ERROR_GAP_MS};
      _steps[_stepCount++] = {BUZZER_ERROR_BEEP_MS, BUZZER_ERROR_GAP_MS};
      _steps[_stepCount++] = {BUZZER_ERROR_BEEP_MS, 0};
      break;
  }
}

void Buzzer::update() {
  if (_pending != 0xFF) {                       // new request (latest wins)
    loadPattern(static_cast<Pattern>(_pending - 1));
    _pending = 0xFF;
    _step = 0;
    _stepStartMs = millis();
    _sounding = false;
    _active = _stepCount > 0;
    if (_active) {                              // start first step at once
      Step s = _steps[0];
      ledcWrite(BUZZER_LEDC_CHANNEL, s.onMs > 0 ? BUZZER_DUTY_ON : 0);
      _sounding = s.onMs > 0;
    } else {
      silence();
    }
    return;
  }
  if (!_active) return;

  Step s = _steps[_step];
  uint16_t phaseMs = _sounding ? s.onMs : s.offMs;
  if ((millis() - _stepStartMs) < phaseMs) return;

  _stepStartMs = millis();
  if (_sounding) {                              // on-phase finished
    ledcWrite(BUZZER_LEDC_CHANNEL, 0);
    _sounding = false;
    if (s.offMs > 0) return;                    // wait for the gap first
  }
  if (++_step >= _stepCount) {
    _active = false;
    silence();
    return;
  }
  Step n = _steps[_step];                       // start next step
  ledcWrite(BUZZER_LEDC_CHANNEL, n.onMs > 0 ? BUZZER_DUTY_ON : 0);
  _sounding = n.onMs > 0;
}

#endif // BUZZER_ENABLED
