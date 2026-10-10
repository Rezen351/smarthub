#include "Gn6932Display.h"
#include "Logger.h"

constexpr uint8_t Gn6932Display::SECTION1_GRIDS[];
constexpr uint8_t Gn6932Display::SECTION2_GRIDS[];
constexpr uint8_t Gn6932Display::SECTION3_GRIDS[];

Gn6932Display::Gn6932Display(uint8_t clkPin, uint8_t dinPin, uint8_t stbPin)
    : _display(clkPin, dinPin, stbPin) {}

void Gn6932Display::begin() {
  _display.begin();
  _display.setBrightness(1);
  _display.displayOn(1);
  _enabled = true;
  LOG_INFO("display", "GN6932 initialized (16 grids, 3 sections)");
}

void Gn6932Display::clear() {
  if (!_enabled) return;
  _display.clear();
}

void Gn6932Display::setBrightness(uint8_t brightness) {
  if (brightness > GN6932::MAX_BRIGHTNESS) {
    brightness = GN6932::MAX_BRIGHTNESS;
  }
  _display.setBrightness(brightness);
}

void Gn6932Display::showGridMask(uint8_t grid, uint8_t mask) {
  if (!_enabled || grid >= GN6932::GRID_COUNT) return;
  _display.setGrid(grid, mask);
}

void Gn6932Display::showAllMask(uint8_t mask) {
  if (!_enabled) return;
  uint8_t segments[GN6932::GRID_COUNT];
  for (uint8_t i = 0; i < GN6932::GRID_COUNT; ++i) {
    segments[i] = mask;
  }
  _display.writeGrids(segments);
}

void Gn6932Display::showCharacter(uint8_t grid, char symbol) {
  showGridMask(grid, calibratedMask(symbol));
}

bool Gn6932Display::showSection(uint8_t section, const char* text) {
  if (!_enabled || text == nullptr || section < 1 || section > 3) {
    return false;
  }

  static constexpr uint8_t section1[] = {0, 1, 2, 3, 4};
  static constexpr uint8_t section2[] = {5, 6, 7, 8, 9};
  static constexpr uint8_t section3[] = {10, 11, 12, 13, 14, 15};
  const uint8_t* grids = section == 1 ? section1 : (section == 2 ? section2 : section3);
  const uint8_t count = section == 3 ? SECTION3_GRID_COUNT : SECTION1_GRID_COUNT;
  const uint8_t dpGrid = section == 1 ? SECTION1_DP_GRID :
                         (section == 2 ? SECTION2_DP_GRID : SECTION3_DP_GRID);
  char padded[SECTION3_GRID_COUNT + 1] = {};
  for (uint8_t i = 0; i < count && text[i] != '\0'; ++i) {
    padded[i] = text[i];
  }
  renderSection(grids, count, padded, dpGrid);
  return true;
}

uint8_t Gn6932Display::calibratedMask(char symbol) {
  switch (symbol) {
    case '0':
      return 0x20 | 0x80 | 0x01 | 0x02 | 0x08 | 0x10;
    case '1':
      return 0x80 | 0x01;
    case '2':
      return 0x20 | 0x80 | 0x40 | 0x08 | 0x02;
    case '3':
      return 0x20 | 0x80 | 0x01 | 0x02 | 0x40;
    case '4':
      return 0x10 | 0x40 | 0x80 | 0x01;
    case '5':
      return 0x20 | 0x10 | 0x40 | 0x01 | 0x02;
    case '6':
      return 0x20 | 0x10 | 0x40 | 0x08 | 0x01 | 0x02;
    case '7':
      return 0x20 | 0x80 | 0x01;
    case '8':
      return 0x20 | 0x80 | 0x01 | 0x02 | 0x08 | 0x10 | 0x40;
    case '9':
      return 0x20 | 0x80 | 0x01 | 0x02 | 0x10 | 0x40;
    case 'A':
      return 0x20 | 0x80 | 0x01 | 0x08 | 0x10 | 0x40;
    case 'B':
      return 0x01 | 0x02 | 0x08 | 0x10 | 0x40;
    case 'C':
      return 0x20 | 0x02 | 0x08 | 0x10;
    case 'D':
      return 0x80 | 0x01 | 0x02 | 0x08 | 0x40;
    case 'E':
      return 0x20 | 0x02 | 0x08 | 0x10 | 0x40;
    case 'F':
      return 0x20 | 0x08 | 0x10 | 0x40;
    case 'G':
      return 0x20 | 0x01 | 0x02 | 0x08 | 0x10;
    case 'H':
      return 0x80 | 0x01 | 0x08 | 0x10 | 0x40;
    case 'I':
      return 0x80 | 0x01;
    case 'J':
      return 0x80 | 0x01 | 0x02 | 0x08;
    case 'K':
      return 0x08 | 0x10 | 0x40;
    case 'L':
      return 0x02 | 0x08 | 0x10;
    case 'M':
      return 0x20 | 0x01 | 0x08 | 0x40;
    case 'N':
      return 0x01 | 0x08 | 0x40;
    case 'O':
      return 0x20 | 0x80 | 0x01 | 0x02 | 0x08 | 0x10;
    case 'P':
      return 0x20 | 0x80 | 0x08 | 0x10 | 0x40;
    case 'Q':
      return 0x20 | 0x80 | 0x01 | 0x02 | 0x10 | 0x40;
    case 'R':
      return 0x08 | 0x40;
    case 'S':
      return 0x20 | 0x01 | 0x02 | 0x10 | 0x40;
    case 'T':
      return 0x02 | 0x08 | 0x10 | 0x40;
    case 'U':
      return 0x80 | 0x01 | 0x02 | 0x08 | 0x10;
    case 'V':
      return 0x80 | 0x01 | 0x02 | 0x08 | 0x10;
    case 'W':
      return 0x80 | 0x01 | 0x02 | 0x08 | 0x10;
    case 'X':
      return 0x80 | 0x01 | 0x08 | 0x10 | 0x40;
    case 'Y':
      return 0x80 | 0x01 | 0x02 | 0x10 | 0x40;
    case 'Z':
      return 0x20 | 0x80 | 0x02 | 0x08 | 0x40;
    default:
      return 0;
  }
}

void Gn6932Display::renderSection(const uint8_t* grids, uint8_t gridCount,
                                   const char* text, uint8_t dpGrid) {
  uint8_t segments[GN6932::GRID_COUNT] = {};

  for (uint8_t i = 0; i < gridCount; ++i) {
    char symbol[2] = {text[i], '\0'};
    segments[grids[i]] = calibratedMask(symbol[0]);
  }
  if (dpGrid < GN6932::GRID_COUNT) segments[dpGrid] |= 0x04;

  uint8_t startGrid = grids[0];
  _display.writeGrids(segments + startGrid, startGrid, gridCount);
}

void Gn6932Display::formatRightAligned(char* buffer, size_t size, uint32_t value,
                                        uint8_t totalDigits) {
  char tmp[16];
  snprintf(tmp, sizeof(tmp), "%lu", (unsigned long)value);
  uint8_t len = strlen(tmp);
  uint8_t pad = totalDigits > len ? totalDigits - len : 0;

  for (uint8_t i = 0; i < pad && i < totalDigits; ++i) {
    buffer[i] = ' ';
  }
  for (uint8_t i = 0; i < len && (pad + i) < totalDigits; ++i) {
    buffer[pad + i] = tmp[i];
  }
  buffer[totalDigits] = '\0';
}

void Gn6932Display::showWeight(float weightKg) {
  if (!_enabled) return;

  float absWeight = weightKg < 0.0f ? -weightKg : weightKg;
  uint32_t centiWeight = (uint32_t)(absWeight * 100.0f + 0.5f);
  if (centiWeight > 99999) centiWeight = 99999;

  char text[SECTION1_GRID_COUNT + 1] = {0};
  formatRightAligned(text, sizeof(text) - 1, centiWeight, SECTION1_GRID_COUNT);

  uint8_t segments[GN6932::GRID_COUNT] = {};
  for (uint8_t i = 0; i < SECTION1_GRID_COUNT; ++i) {
    segments[SECTION1_GRIDS[i]] = calibratedMask(text[i]);
  }
  segments[SECTION1_DP_GRID] |= 0x04;

  _display.writeGrids(segments, 0, SECTION1_GRID_COUNT);
}

void Gn6932Display::showUnitPriceCenti(uint32_t priceCenti) {
  if (!_enabled) return;

  if (priceCenti > 99999) priceCenti = 99999;

  char text[SECTION2_GRID_COUNT + 1] = {0};
  formatRightAligned(text, sizeof(text) - 1, priceCenti, SECTION2_GRID_COUNT);

  uint8_t segments[GN6932::GRID_COUNT] = {};
  for (uint8_t i = 0; i < SECTION2_GRID_COUNT; ++i) {
    segments[SECTION2_GRIDS[i]] = calibratedMask(text[i]);
  }
  segments[SECTION2_DP_GRID] |= 0x04;

  _display.writeGrids(segments + SECTION2_GRIDS[0], SECTION2_GRIDS[0], SECTION2_GRID_COUNT);
}

void Gn6932Display::showTotalPriceCenti(uint64_t totalPriceCenti) {
  if (!_enabled) return;

  if (totalPriceCenti > 999999) totalPriceCenti = 999999;

  char text[SECTION3_GRID_COUNT + 1] = {0};
  formatRightAligned(text, sizeof(text) - 1,
                     static_cast<uint32_t>(totalPriceCenti),
                     SECTION3_GRID_COUNT);

  uint8_t segments[GN6932::GRID_COUNT] = {};
  for (uint8_t i = 0; i < SECTION3_GRID_COUNT; ++i) {
    segments[SECTION3_GRIDS[i]] = calibratedMask(text[i]);
  }
  segments[SECTION3_DP_GRID] |= 0x04;

  _display.writeGrids(segments + SECTION3_GRIDS[0], SECTION3_GRIDS[0], SECTION3_GRID_COUNT);
}
