#include "Gn6932Display.h"
#include "Logger.h"

constexpr uint8_t Gn6932Display::SECTION1_GRIDS[];
constexpr uint8_t Gn6932Display::SECTION2_GRIDS[];
constexpr uint8_t Gn6932Display::SECTION3_GRIDS[];

// Decimal places needed to print an unsigned integer.
static uint8_t digitCount(uint64_t value) {
  uint8_t digits = 1;
  while (value >= 10) {
    value /= 10;
    ++digits;
  }
  return digits;
}

// Section number owning a grid range, used to know which indicator DPs apply.
static uint8_t sectionOfGrids(const uint8_t* grids) {
  if (grids[0] < 5) return 1;
  if (grids[0] < 10) return 2;
  return 3;
}

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

// Renders literal text in a section. A '.' never occupies a grid: it ORs the
// DP bit onto the previously rendered grid, so "12.50" renders as
// '1', '2'+DP, '5', '0' and a trailing "192." as '1', '9', '2'+DP.
// With rightAlign the glyphs start at the right edge of the section, so typed
// digits grow from the right like a calculator entry.
bool Gn6932Display::showSectionText(uint8_t section, const char* text, bool rightAlign) {
  if (!_enabled || text == nullptr || section < 1 || section > 3) {
    return false;
  }

  static constexpr uint8_t section1[] = {0, 1, 2, 3, 4};
  static constexpr uint8_t section2[] = {5, 6, 7, 8, 9};
  static constexpr uint8_t section3[] = {10, 11, 12, 13, 14, 15};
  const uint8_t* grids = section == 1 ? section1 : (section == 2 ? section2 : section3);
  const uint8_t count = section == 3 ? SECTION3_GRID_COUNT : SECTION1_GRID_COUNT;

  renderSectionText(grids, count, text, rightAlign);
  return true;
}

void Gn6932Display::renderSectionText(const uint8_t* grids, uint8_t gridCount,
                                      const char* text, bool rightAlign) {
  uint8_t segments[GN6932::GRID_COUNT] = {};

  // A '.' is a modifier, not a glyph, so alignment counts glyph positions.
  uint8_t glyphCount = 0;
  for (uint8_t i = 0; text != nullptr && text[i] != '\0'; ++i) {
    if (text[i] != '.') ++glyphCount;
  }
  if (glyphCount > gridCount) glyphCount = gridCount;

  uint8_t first = rightAlign ? gridCount - glyphCount : 0;
  uint8_t rendered = first;
  for (uint8_t i = 0; text != nullptr && text[i] != '\0' && rendered < gridCount; ++i) {
    char symbol = text[i];
    if (symbol == '.') {
      if (rendered > first) {
        segments[grids[rendered - 1]] |= 0x04;   // DP rides on the previous grid
      }
      continue;
    }
    segments[grids[rendered]] = calibratedMask(symbol);
    ++rendered;
  }

  uint8_t startGrid = grids[0];
  applyIndicators(segments, sectionOfGrids(grids));
  _display.writeGrids(segments + startGrid, startGrid, gridCount);
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
  if (centiWeight > 99999) centiWeight = 99999;   // max 999.99 kg

  char text[SECTION1_GRID_COUNT + 1] = {0};
  formatRightAligned(text, sizeof(text) - 1, centiWeight, SECTION1_GRID_COUNT);

  uint8_t segments[GN6932::GRID_COUNT] = {};
  for (uint8_t i = 0; i < SECTION1_GRID_COUNT; ++i) {
    segments[SECTION1_GRIDS[i]] = calibratedMask(text[i]);
  }
  segments[SECTION1_DP_GRID] |= 0x04;
  applyIndicators(segments, 1);

  _display.writeGrids(segments, 0, SECTION1_GRID_COUNT);
}

void Gn6932Display::showUnitPriceCenti(uint32_t priceCenti) {
  if (!_enabled) return;
  renderMoneySection(SECTION2_GRIDS, SECTION2_GRID_COUNT, priceCenti);
}

void Gn6932Display::showTotalPriceCenti(uint64_t totalPriceCenti) {
  if (!_enabled) return;
  renderMoneySection(SECTION3_GRIDS, SECTION3_GRID_COUNT, totalPriceCenti);
}

// Overlays the indicator decimal points on a rendered section. The DPs share
// no digit with the value decimal points of the weight (grid 3) or the money
// sections, so a lamp never disturbs the displayed value.
void Gn6932Display::applyIndicators(uint8_t* segments, uint8_t section) {
  if (section == 1) {
    if (_ind.tare) segments[INDICATOR_TARE_GRID] |= 0x04;
    if (_ind.zero) segments[INDICATOR_ZERO_GRID] |= 0x04;
  } else if (section == 2) {
    if (_ind.stab) segments[INDICATOR_STAB_GRID] |= 0x04;
  }
}

// Money rule: a zero fraction renders as a plain integer when it fits,
// otherwise the most decimals that fit are used (2 -> 1 -> 0). Each tier is
// rounded first and the width is re-checked, so a rounding carry such as
// 9999.99 cents steps down instead of overflowing the section.
void Gn6932Display::renderMoneySection(const uint8_t* grids, uint8_t gridCount,
                                       uint64_t cents) {
  uint8_t segments[GN6932::GRID_COUNT] = {};

  uint64_t whole = cents / 100;
  uint64_t frac = cents % 100;
  uint8_t decimals = 0;

  if (frac == 0 && digitCount(whole) <= gridCount) {
    decimals = 0;                                   // integer, no decimal point
  } else {
    for (uint8_t d = 2; ; --d) {
      uint64_t scaled = d == 2 ? cents : (d == 1 ? (cents + 5) / 10 : (cents + 50) / 100);
      uint64_t divisor = d == 2 ? 100 : (d == 1 ? 10 : 1);
      decimals = d;
      whole = scaled / divisor;
      frac = scaled % divisor;
      if (digitCount(whole) + d <= gridCount) break;
      if (d == 0) break;                            // clamp to the section width
    }
  }

  char wholeText[24];
  snprintf(wholeText, sizeof(wholeText), "%llu", (unsigned long long)whole);
  uint8_t wholeLen = (uint8_t)strlen(wholeText);

  char glyphs[32];
  uint8_t glyphCount = 0;
  for (uint8_t i = 0; i < wholeLen; ++i) {
    glyphs[glyphCount++] = wholeText[i];
  }
  for (uint8_t i = 0; i < decimals; ++i) {
    uint64_t divisor = 1;
    for (uint8_t k = 0; k < decimals - 1 - i; ++k) {
      divisor *= 10;
    }
    glyphs[glyphCount++] = (char)('0' + (frac / divisor) % 10);
  }
  glyphs[glyphCount] = '\0';

  uint8_t shown = glyphCount > gridCount ? gridCount : glyphCount;
  uint8_t start = glyphCount - shown;               // drop leading digits when clamped
  uint8_t pad = gridCount - shown;

  char text[SECTION3_GRID_COUNT + 1];
  for (uint8_t i = 0; i < gridCount; ++i) {
    text[i] = ' ';
  }
  for (uint8_t i = 0; i < shown; ++i) {
    text[pad + i] = glyphs[start + i];
  }
  text[gridCount] = '\0';

  for (uint8_t i = 0; i < gridCount; ++i) {
    segments[grids[i]] = calibratedMask(text[i]);
  }

  uint8_t dpIndex = NO_DP_INDEX;
  if (decimals > 0 && wholeLen > 0) {
    uint8_t wholeDp = wholeLen - 1;                 // DP rides on the last whole digit
    if (wholeDp >= start) {
      dpIndex = pad + (wholeDp - start);
    }
  }
  if (dpIndex != NO_DP_INDEX) {
    segments[grids[dpIndex]] |= 0x04;
  }

  uint8_t startGrid = grids[0];
  applyIndicators(segments, sectionOfGrids(grids));
  _display.writeGrids(segments + startGrid, startGrid, gridCount);
}
