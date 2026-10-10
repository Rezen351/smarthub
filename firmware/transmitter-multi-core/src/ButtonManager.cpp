#include "ButtonManager.h"
#include "Logger.h"
#include "Buzzer.h"

#if KEYPAD_ENABLED

static constexpr uint8_t BTN_C = 0;
static constexpr uint8_t BTN_ADD = 1;
static constexpr uint8_t BTN_TARE = 2;
static constexpr uint8_t BTN_ZERO = 3;
static constexpr uint8_t BTN_M4 = 4;
static constexpr uint8_t BTN_9 = 5;
static constexpr uint8_t BTN_6 = 6;
static constexpr uint8_t BTN_3 = 7;
static constexpr uint8_t BTN_STORE = 8;
static constexpr uint8_t BTN_M3 = 9;
static constexpr uint8_t BTN_8 = 10;
static constexpr uint8_t BTN_5 = 11;
static constexpr uint8_t BTN_2 = 12;
static constexpr uint8_t BTN_DP = 13;
static constexpr uint8_t BTN_M2 = 14;
static constexpr uint8_t BTN_7 = 15;
static constexpr uint8_t BTN_4 = 16;
static constexpr uint8_t BTN_1 = 17;
static constexpr uint8_t BTN_0 = 18;
static constexpr uint8_t BTN_M1 = 19;

static const char* buttonLabel(uint8_t id) {
  switch (id) {
    case 0:  return "C";
    case 1:  return "ADD";
    case 2:  return "TARE";
    case 3:  return "ZERO";
    case 4:  return "M4";
    case 5:  return "9";
    case 6:  return "6";
    case 7:  return "3";
    case 8:  return "STORE";
    case 9:  return "M3";
    case 10: return "8";
    case 11: return "5";
    case 12: return "2";
    case 13: return "DP";
    case 14: return "M2";
    case 15: return "7";
    case 16: return "4";
    case 17: return "1";
    case 18: return "0";
    case 19: return "M1";
    default: return "?";
  }
}

// Only M1-M3 carry a preset; M4 is the network info page.
static bool isPresetKey(uint8_t id) {
  return id == BTN_M1 || id == BTN_M2 || id == BTN_M3;
}

static uint8_t presetIndexFromId(uint8_t id) {
  switch (id) {
    case BTN_M1: return 1;
    case BTN_M2: return 2;
    case BTN_M3: return 3;
    default:     return 0;
  }
}

ButtonManager::ButtonManager(SharedState* shared, SettingsStore* settings, Buzzer* buzzer)
    : _shared(shared), _settings(settings), _buzzer(buzzer), _scanner(),
      _entryLen(0), _currentPriceCenti(0), _totalPriceCenti(0) {
  _entry[0] = '\0';
}

void ButtonManager::begin() {
  _scanner.begin();
  _totalPriceCenti = _settings->loadTotalPrice();
  LOG_INFO("keypad", "ButtonManager initialized (4x5 matrix)");
}

void ButtonManager::update() {
  MatrixEvent ev = _scanner.update();
  if (ev.type == ButtonEvent::Pressed) {
    // Preset recall is deferred to the release so a long-press save always
    // reads the entry as typed instead of a freshly recalled value.
    if (!_testMode && isPresetKey(ev.buttonId)) {
      _pendingPreset = presetIndexFromId(ev.buttonId);
    }
    handlePress(ev.buttonId);
  } else if (ev.type == ButtonEvent::Released) {
    if (!_testMode && _pendingPreset != 0 &&
        presetIndexFromId(ev.buttonId) == _pendingPreset) {
      recallPreset(_pendingPreset);
      _pendingPreset = 0;
    }
    if (_testMode) {
      Serial.printf("KEYPAD TEST: released id=%u [%s]\n",
                    (unsigned)ev.buttonId, buttonLabel(ev.buttonId));
    }
  } else if (ev.type == ButtonEvent::Held) {
    if (_testMode) {
      Serial.printf("KEYPAD TEST: held id=%u [%s]\n",
                    (unsigned)ev.buttonId, buttonLabel(ev.buttonId));
    } else if (isPresetKey(ev.buttonId)) {
      savePreset(presetIndexFromId(ev.buttonId));
      _pendingPreset = 0;
    }
  }
}

void ButtonManager::handlePress(uint8_t buttonId) {
  LOG_INFO("keypad", "button pressed id=%u", (unsigned)buttonId);

  if (_testMode) {
    Serial.printf("KEYPAD TEST: pressed id=%u [%s]\n",
                  (unsigned)buttonId, buttonLabel(buttonId));
    return;
  }

#if BUZZER_ENABLED
  if (_buzzer != nullptr) _buzzer->play(Buzzer::Pattern::Press);
#endif

  char digit = 0;
  bool isDigit = false;

  switch (buttonId) {
    case 5:  digit = '9'; isDigit = true; break;
    case 6:  digit = '6'; isDigit = true; break;
    case 7:  digit = '3'; isDigit = true; break;
    case 10: digit = '8'; isDigit = true; break;
    case 11: digit = '5'; isDigit = true; break;
    case 12: digit = '2'; isDigit = true; break;
    case 15: digit = '7'; isDigit = true; break;
    case 16: digit = '4'; isDigit = true; break;
    case 17: digit = '1'; isDigit = true; break;
    case 18: digit = '0'; isDigit = true; break;
    default: break;
  }

  if (isDigit) {
    appendDigit(digit);
    return;
  }

  switch (buttonId) {
    case BTN_DP:
      placeDecimal();
      break;
    case BTN_C:
      clearEntry();
      _totalPriceCenti = 0;
      _settings->saveTotalPrice(_totalPriceCenti);
      LOG_INFO("keypad", "C reset price entry and accumulated total");
      break;
    case BTN_TARE:
      _shared->requestCommand(CMD_TARE);
      LOG_INFO("keypad", "TARE requested (container tare, calibration kept)");
      break;
    case BTN_ZERO:
      _shared->requestCommand(CMD_ZERO);
      LOG_INFO("keypad", "ZERO requested (scale zero point)");
      break;
    case BTN_ADD:
      commitAdd();
      break;
    case BTN_STORE:
      _settings->saveTotalPrice(_totalPriceCenti);
      _shared->requestCommand(CMD_FLUSH);
      LOG_INFO("keypad", "STORE persisted total=%llu cents",
               (unsigned long long)_totalPriceCenti);
      break;
    case BTN_M4:
      _netInfoRequest = true;
      LOG_INFO("keypad", "M4 network info requested");
      break;
    default:
      break;
  }
}

void ButtonManager::appendDigit(char digit) {
  uint8_t integerDigits = 0;
  uint8_t fractionalDigits = 0;
  bool decimal = false;
  for (uint8_t i = 0; i < _entryLen; ++i) {
    if (_entry[i] == '.') {
      decimal = true;
    } else if (decimal) {
      ++fractionalDigits;
    } else {
      ++integerDigits;
    }
  }
  if (_entryLen < sizeof(_entry) - 1 &&
      ((!decimal && integerDigits < 5) || (decimal && fractionalDigits < 2))) {
    _entry[_entryLen++] = digit;
    _entry[_entryLen] = '\0';
    _currentPriceCenti = parseEntryCenti();
    LOG_INFO("keypad", "digit entry=%s price=%lu cents",
             _entry, (unsigned long)_currentPriceCenti);
  }
}

void ButtonManager::placeDecimal() {
  bool hasDp = false;
  for (uint8_t i = 0; i < _entryLen; ++i) {
    if (_entry[i] == '.') { hasDp = true; break; }
  }
  if (!hasDp && _entryLen < sizeof(_entry) - 1) {
    _entry[_entryLen++] = '.';
    _entry[_entryLen] = '\0';
    LOG_INFO("keypad", "decimal placed entry=%s", _entry);
  }
}

void ButtonManager::clearEntry() {
  _entryLen = 0;
  _entry[0] = '\0';
  _currentPriceCenti = 0;
  LOG_INFO("keypad", "entry cleared");
}

void ButtonManager::recallPreset(uint8_t presetIndex) {
  AppSettings s;
  _settings->load(s);

  float price = 0.0f;
  switch (presetIndex) {
    case 1: price = s.price1; break;
    case 2: price = s.price2; break;
    case 3: price = s.price3; break;
  }

  uint32_t priceCenti = static_cast<uint32_t>(price * 100.0f + 0.5f);
  // Round presets are stored/typed without a decimal point, so the display
  // shows "2500" for 2500 cents worth of round price and "12.50" otherwise.
  if (priceCenti % 100 == 0) {
    snprintf(_entry, sizeof(_entry), "%lu", (unsigned long)(priceCenti / 100));
  } else {
    snprintf(_entry, sizeof(_entry), "%lu.%02lu",
             (unsigned long)(priceCenti / 100),
             (unsigned long)(priceCenti % 100));
  }
  _entryLen = strlen(_entry);
  _currentPriceCenti = priceCenti;
  LOG_INFO("keypad", "recalled preset %u price=%lu cents entry=%s",
           (unsigned)presetIndex, (unsigned long)priceCenti, _entry);
}

void ButtonManager::savePreset(uint8_t presetIndex) {
  if (_currentPriceCenti == 0) {
    LOG_WARN("keypad", "preset save ignored: price entry is empty");
#if BUZZER_ENABLED
    if (_buzzer != nullptr) _buzzer->play(Buzzer::Pattern::Error);
#endif
    return;
  }

  AppSettings s;
  _settings->load(s);
  float price = _currentPriceCenti / 100.0f;
  switch (presetIndex) {
    case 1: s.price1 = price; break;
    case 2: s.price2 = price; break;
    case 3: s.price3 = price; break;
    default: break;
  }
  _settings->savePricePresets(s);
  LOG_INFO("keypad", "preset %u saved price=%lu cents entry=%s",
           (unsigned)presetIndex, (unsigned long)_currentPriceCenti, _entry);
#if BUZZER_ENABLED
  // Buzzer-only confirmation: the weight/price/total layout is never touched.
  if (_buzzer != nullptr) _buzzer->play(Buzzer::Pattern::Confirm);
#endif
}

void ButtonManager::commitAdd() {
  if (_currentPriceCenti == 0) {
    LOG_WARN("keypad", "ADD ignored: unit price is zero");
#if BUZZER_ENABLED
    if (_buzzer != nullptr) _buzzer->play(Buzzer::Pattern::Error);
#endif
    return;
  }

  ScaleSnapshot snap = _shared->getSnapshot();
  if (snap.stableWeightG < 0.0f) {
    LOG_WARN("keypad", "ADD ignored: negative stable weight");
#if BUZZER_ENABLED
    if (_buzzer != nullptr) _buzzer->play(Buzzer::Pattern::Error);
#endif
    return;
  }
  uint64_t weightMilliKg = static_cast<uint64_t>(snap.stableWeightG + 0.5f);
  uint64_t lineTotalCenti =
      (weightMilliKg * _currentPriceCenti + 500) / 1000;
  _totalPriceCenti += lineTotalCenti;

  LOG_INFO("keypad", "ADD weight=%.3f kg price=%lu cents line=%llu cents total=%llu cents",
           snap.stableWeightG / 1000.0f,
           (unsigned long)_currentPriceCenti,
           (unsigned long long)lineTotalCenti,
           (unsigned long long)_totalPriceCenti);

  clearEntry();
}

uint32_t ButtonManager::parseEntryCenti() const {
  uint32_t whole = 0;
  uint32_t fraction = 0;
  uint8_t fractionalDigits = 0;
  bool decimal = false;
  for (uint8_t i = 0; i < _entryLen; ++i) {
    if (_entry[i] == '.') {
      decimal = true;
    } else if (!decimal) {
      whole = whole * 10U + static_cast<uint32_t>(_entry[i] - '0');
    } else if (fractionalDigits < 2) {
      fraction = fraction * 10U + static_cast<uint32_t>(_entry[i] - '0');
      ++fractionalDigits;
    }
  }
  if (fractionalDigits == 0) fraction = 0;
  if (fractionalDigits == 1) fraction *= 10U;
  return whole * 100U + fraction;
}

#endif // KEYPAD_ENABLED
