#pragma once

#include <Arduino.h>
#include "GN6932.h"

class Gn6932Display {
 public:
  static constexpr uint8_t SECTION1_GRID_COUNT = 5;
  static constexpr uint8_t SECTION2_GRID_COUNT = 5;
  static constexpr uint8_t SECTION3_GRID_COUNT = 6;

  Gn6932Display(uint8_t clkPin, uint8_t dinPin, uint8_t stbPin);

  void begin();
  void clear();

  void showWeight(float weightKg);
  void showUnitPriceCenti(uint32_t priceCenti);
  void showTotalPriceCenti(uint64_t totalPriceCenti);
  void showGridMask(uint8_t grid, uint8_t mask);
  void showAllMask(uint8_t mask);
  void showCharacter(uint8_t grid, char symbol);
  bool showSection(uint8_t section, const char* text);
  bool showSectionText(uint8_t section, const char* text,
                       bool rightAlign = false);   // '.' = DP on previous grid
  void setBrightness(uint8_t brightness);

  // Decimal-point lamps overlaid on every section 1 / section 2 render.
  struct DisplayIndicators { bool tare; bool zero; bool stab; };
  void setIndicators(const DisplayIndicators& ind) { _ind = ind; }

  bool enabled() { return _enabled; }
  void setEnabled(bool e) { _enabled = e; }

 private:
  static constexpr uint8_t SECTION1_GRIDS[] = {0, 1, 2, 3, 4};
  static constexpr uint8_t SECTION2_GRIDS[] = {5, 6, 7, 8, 9};
  static constexpr uint8_t SECTION3_GRIDS[] = {10, 11, 12, 13, 14, 15};
  static constexpr uint8_t SECTION1_DP_GRID = 2;
  static constexpr uint8_t SECTION2_DP_GRID = 7;
  static constexpr uint8_t SECTION3_DP_GRID = 13;
  static constexpr uint8_t INDICATOR_TARE_GRID = 0;       // char 1 DP
  static constexpr uint8_t INDICATOR_ZERO_GRID = 4;       // char 5 DP
  static constexpr uint8_t INDICATOR_STAB_GRID = 5;       // char 6 DP
  static constexpr uint8_t NO_DP_INDEX = 0xFF;            // render without decimal point

  uint8_t calibratedMask(char symbol);
  void renderSection(const uint8_t* grids, uint8_t gridCount, const char* text,
                     uint8_t dpGrid);
  void renderSectionText(const uint8_t* grids, uint8_t gridCount, const char* text,
                         bool rightAlign);
  void renderMoneySection(const uint8_t* grids, uint8_t gridCount, uint64_t cents);
  void applyIndicators(uint8_t* segments, uint8_t section);
  void formatRightAligned(char* buffer, size_t size, uint32_t value,
                          uint8_t totalDigits);

  GN6932 _display;
  bool _enabled = true;
  DisplayIndicators _ind = {false, false, false};
};
