#pragma once

#include <Arduino.h>
#include "config.h"
#include "SharedState.h"
#include "Settings.h"
#include "MatrixScanner.h"

#if KEYPAD_ENABLED

class ButtonManager {
 public:
  ButtonManager(SharedState* shared, SettingsStore* settings);

  void begin();
  void update();

  uint32_t currentUnitPriceCenti() const { return _currentPriceCenti; }
  uint64_t totalPriceCenti() const { return _totalPriceCenti; }

  void setTestMode(bool on) { _testMode = on; }
  bool testMode() const { return _testMode; }

 private:
  void handlePress(uint8_t buttonId);
  void appendDigit(char digit);
  void placeDecimal();
  void clearEntry();
  void recallPreset(uint8_t presetIndex);
  void commitAdd();
  void resetTotal();
  uint32_t parseEntryCenti() const;

  SharedState* _shared;
  SettingsStore* _settings;
  MatrixScanner _scanner;

  char _entry[8];
  uint8_t _entryLen;
  uint32_t _currentPriceCenti;
  uint64_t _totalPriceCenti;
  bool _testMode = false;
};

#endif // KEYPAD_ENABLED
