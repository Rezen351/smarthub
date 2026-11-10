#pragma once

#include <Arduino.h>
#include "config.h"
#include "SharedState.h"
#include "Settings.h"
#include "MatrixScanner.h"

#if KEYPAD_ENABLED

class Buzzer;

class ButtonManager {
 public:
  ButtonManager(SharedState* shared, SettingsStore* settings, Buzzer* buzzer);

  void begin();
  void update();

  uint32_t currentUnitPriceCenti() const { return _currentPriceCenti; }
  uint64_t totalPriceCenti() const { return _totalPriceCenti; }
  const char* entryText() const { return _entry; }   // NUL-terminated, exactly what was typed

  void setTestMode(bool on) {
    _testMode = on;
    if (on) {
      _pendingPreset = 0;
      _netInfoRequest = false;
    }
  }
  bool testMode() const { return _testMode; }

  // Set by M4; consumed by the network task page ticker.
  bool consumeNetworkInfoRequest() {
    bool r = _netInfoRequest;
    _netInfoRequest = false;
    return r;
  }

 private:
  void handlePress(uint8_t buttonId);
  void appendDigit(char digit);
  void placeDecimal();
  void clearEntry();
  void recallPreset(uint8_t presetIndex);
  void savePreset(uint8_t presetIndex);
  void commitAdd();
  uint32_t parseEntryCenti() const;

  SharedState* _shared;
  SettingsStore* _settings;
  Buzzer* _buzzer;
  MatrixScanner _scanner;

  char _entry[8];
  uint8_t _entryLen;
  uint32_t _currentPriceCenti;
  uint64_t _totalPriceCenti;
  bool _testMode = false;
  bool _netInfoRequest = false;
  uint8_t _pendingPreset = 0;   // preset recall deferred until key release
};

#endif // KEYPAD_ENABLED
