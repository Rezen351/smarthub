#include <Arduino.h>
#include <stdlib.h>
#include <string.h>

#include "GN6932.h"
#include "config.h"

GN6932 display1(CLK_PIN, DIN_PIN, CHIP1_STB);
GN6932 display2(CLK_PIN, DIN_PIN, CHIP2_STB);

namespace {
uint8_t frame[DISPLAY_GRID_COUNT] = {};
uint32_t phaseStartedAt = 0;
uint32_t frameStartedAt = 0;
uint8_t phase = 0;
uint8_t grid = 0;
uint8_t bitCount = 0;
uint8_t brightness = 0;
bool manualMode = false;
bool segmentScanMode = false;
bool segmentScanPaused = false;
uint8_t segmentScanGrid = 0;
uint16_t segmentScanMask = 0;
char serialCommand[48] = {};
uint8_t serialCommandLength = 0;
bool ignoreLineFeed = false;

enum TestPhase : uint8_t {
  GRID_FULL_WALK = 0,
  GRID_BIT_WALK,
  BRIGHTNESS_SWEEP,
};

void beginPhase(uint8_t nextPhase);

void writeFrame() {
  display1.writeGrids(frame);
  if (CHIP2_STB != CHIP1_STB) {
    display2.writeGrids(frame);
  }
}

void clearFrame() {
  memset(frame, 0, sizeof(frame));
  writeFrame();
}

void setAllFrame() {
  memset(frame, 0xFF, sizeof(frame));
  writeFrame();
}

void printPins() {
  Serial.print(F("CLK="));
  Serial.print(CLK_PIN);
  Serial.print(F(" DIN="));
  Serial.print(DIN_PIN);
  Serial.print(F(" STB1="));
  Serial.print(CHIP1_STB);
  Serial.print(F(" STB2="));
  Serial.println(CHIP2_STB);
}

void printHelp() {
  Serial.println(F("Commands:"));
  Serial.println(F("  grid <1-16|all> <0x00-0xFF>  show exact segment mask"));
  Serial.println(F("  bit <1-16> <1-8>          show cumulative bits"));
  Serial.println(F("  char <1-16|all> <0-9|A-Z|DP>  show calibrated character"));
  Serial.println(F("  section <1|2|3> <text>    show configured display section"));
  Serial.println(F("  scan segment [1-16]       scan 0x00 through 0xFF"));
  Serial.println(F("  clear                     turn all grids off"));
  Serial.println(F("  stop                      stop segment scan"));
  Serial.println(F("  auto                      resume automatic test"));
  Serial.println(F("During scan: Enter=pause, Enter again=continue"));
  Serial.println(F("Examples: grid 3 0xA5, scan segment 3"));
}

uint8_t calibratedMask(char symbol) {
  switch (symbol) {
    case '0':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_D |
             SEGMENT_E | SEGMENT_F;
    case '1':
      return SEGMENT_B | SEGMENT_C;
    case '2':
      return SEGMENT_A | SEGMENT_B | SEGMENT_G | SEGMENT_E | SEGMENT_D;
    case '3':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_G;
    case '4':
      return SEGMENT_F | SEGMENT_G | SEGMENT_B | SEGMENT_C;
    case '5':
      return SEGMENT_A | SEGMENT_F | SEGMENT_G | SEGMENT_C | SEGMENT_D;
    case '6':
      return SEGMENT_A | SEGMENT_F | SEGMENT_G | SEGMENT_E |
             SEGMENT_C | SEGMENT_D;
    case '7':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C;
    case '8':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_D |
             SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case '9':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_D |
             SEGMENT_F | SEGMENT_G;
    case 'A':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_E |
             SEGMENT_F | SEGMENT_G;
    case 'B':
      return SEGMENT_C | SEGMENT_D | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'C':
      return SEGMENT_A | SEGMENT_D | SEGMENT_E | SEGMENT_F;
    case 'D':
      return SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_E | SEGMENT_G;
    case 'E':
      return SEGMENT_A | SEGMENT_D | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'F':
      return SEGMENT_A | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'G':
      return SEGMENT_A | SEGMENT_C | SEGMENT_D | SEGMENT_E | SEGMENT_F;
    case 'H':
      return SEGMENT_B | SEGMENT_C | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'I':
      return SEGMENT_B | SEGMENT_C;
    case 'J':
      return SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_E;
    case 'K':
      return SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'L':
      return SEGMENT_D | SEGMENT_E | SEGMENT_F;
    case 'M':
      return SEGMENT_A | SEGMENT_C | SEGMENT_E | SEGMENT_G;
    case 'N':
      return SEGMENT_C | SEGMENT_E | SEGMENT_G;
    case 'O':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_D |
             SEGMENT_E | SEGMENT_F;
    case 'P':
      return SEGMENT_A | SEGMENT_B | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'Q':
      return SEGMENT_A | SEGMENT_B | SEGMENT_C | SEGMENT_D |
             SEGMENT_F | SEGMENT_G;
    case 'R':
      return SEGMENT_E | SEGMENT_G;
    case 'S':
      return SEGMENT_A | SEGMENT_C | SEGMENT_D | SEGMENT_F | SEGMENT_G;
    case 'T':
      return SEGMENT_D | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'U':
      return SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_E | SEGMENT_F;
    case 'V':
      return SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_E | SEGMENT_F;
    case 'W':
      return SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_E | SEGMENT_F;
    case 'X':
      return SEGMENT_B | SEGMENT_C | SEGMENT_E | SEGMENT_F | SEGMENT_G;
    case 'Y':
      return SEGMENT_B | SEGMENT_C | SEGMENT_D | SEGMENT_F | SEGMENT_G;
    case 'Z':
      return SEGMENT_A | SEGMENT_B | SEGMENT_D | SEGMENT_E | SEGMENT_G;
    default:
      return 0;
  }
}

void showCalibratedCharacter(uint8_t selectedGrid, const char* text) {
  if (text == nullptr) {
    Serial.println(F("Usage: char <1-16|all> <0-9|A-Z|DP>"));
    return;
  }

  uint8_t mask = 0;
  if (strcmp(text, "DP") == 0 || strcmp(text, "dp") == 0) {
    mask = SEGMENT_DP;
  } else if (text[0] != '\0' && text[1] == '\0') {
    char symbol = text[0];
    if (symbol >= 'a' && symbol <= 'z') {
      symbol = static_cast<char>(symbol - ('a' - 'A'));
    }
    mask = calibratedMask(symbol);
  } else {
    Serial.println(F("Character must be 0-9, A-F, or DP."));
    return;
  }

  manualMode = true;
  segmentScanMode = false;
  segmentScanPaused = false;
  memset(frame, 0, sizeof(frame));
  frame[selectedGrid] = mask;
  writeFrame();

  Serial.print(F("Calibrated grid "));
  Serial.print(selectedGrid + 1);
  Serial.print(F(" character "));
  Serial.print(text);
  Serial.print(F(": 0x"));
  if (mask < 0x10) {
    Serial.print(F("0"));
  }
  Serial.println(mask, HEX);
}

bool decodeCharacter(const char* text, uint8_t* mask) {
  if (text == nullptr || mask == nullptr) {
    return false;
  }
  if (strcmp(text, "DP") == 0 || strcmp(text, "dp") == 0) {
    *mask = SEGMENT_DP;
    return true;
  }
  if (text[0] == '\0' || text[1] != '\0') {
    return false;
  }
  char symbol = text[0];
  if (symbol >= 'a' && symbol <= 'z') {
    symbol = static_cast<char>(symbol - ('a' - 'A'));
  }
  *mask = calibratedMask(symbol);
  return true;
}

void showSection(uint8_t section, const char* text) {
  static const uint8_t sectionOneGrids[] = {0, 1, 2, 3, 4};
  static const uint8_t sectionTwoGrids[] = {5, 6, 7, 8, 9};
  static const uint8_t sectionThreeGrids[] = {10, 11, 12, 13, 14, 15};
  static const uint8_t sectionOneDp[] = {0, 1, 2, 3, 4};
  static const uint8_t sectionTwoDp[] = {5, 6, 7, 8, 9};
  static const uint8_t sectionThreeDp[] = {10, 11, 12, 13, 14, 15};

  const uint8_t* grids = nullptr;
  const uint8_t* dpGrids = nullptr;
  uint8_t gridCount = 0;
  uint8_t dpCount = 0;
  if (section == 1) {
    grids = sectionOneGrids;
    dpGrids = sectionOneDp;
    gridCount = 5;
    dpCount = 2;
  } else if (section == 2) {
    grids = sectionTwoGrids;
    dpGrids = sectionTwoDp;
    gridCount = 5;
    dpCount = 4;
  } else if (section == 3) {
    grids = sectionThreeGrids;
    dpGrids = sectionThreeDp;
    gridCount = 6;
    dpCount = 3;
  } else {
    Serial.println(F("Section must be 1, 2, or 3."));
    return;
  }

  if (text == nullptr || strlen(text) != gridCount) {
    Serial.print(F("Section "));
    Serial.print(section);
    Serial.print(F(" requires exactly "));
    Serial.print(gridCount);
    Serial.println(F(" characters."));
    return;
  }

  memset(frame, 0, sizeof(frame));
  for (uint8_t i = 0; i < gridCount; ++i) {
    char symbol[2] = {text[i], '\0'};
    uint8_t mask = 0;
    if (!decodeCharacter(symbol, &mask)) {
      Serial.println(F("Section text supports only 0-9 and A-Z."));
      return;
    }
    frame[grids[i]] = mask;
  }
  for (uint8_t i = 0; i < dpCount; ++i) {
    frame[dpGrids[i]] |= SEGMENT_DP;
  }

  manualMode = true;
  segmentScanMode = false;
  segmentScanPaused = false;
  writeFrame();
  Serial.print(F("Section "));
  Serial.print(section);
  Serial.print(F(" displayed: "));
  Serial.println(text);
}

bool parseNumber(const char* text, unsigned long minValue,
                 unsigned long maxValue, unsigned long* result) {
  if (text == nullptr || result == nullptr || *text == '\0') {
    return false;
  }

  char* end = nullptr;
  const unsigned long value = strtoul(text, &end, 0);
  if (*end != '\0' || value < minValue || value > maxValue) {
    return false;
  }

  *result = value;
  return true;
}

bool parseGridSelector(const char* text, bool* allGrids,
                       unsigned long* gridNumber) {
  if (text == nullptr || allGrids == nullptr || gridNumber == nullptr) {
    return false;
  }
  if (strcmp(text, "all") == 0 || strcmp(text, "ALL") == 0) {
    *allGrids = true;
    *gridNumber = 1;
    return true;
  }
  *allGrids = false;
  return parseNumber(text, 1, DISPLAY_GRID_COUNT, gridNumber);
}

void showCalibratedCharacterOnAllGrids(const char* text) {
  if (text == nullptr) {
    Serial.println(F("Usage: char <1-16|all> <0-9|A-Z|DP>"));
    return;
  }

  uint8_t mask = 0;
  if (strcmp(text, "DP") == 0 || strcmp(text, "dp") == 0) {
    mask = SEGMENT_DP;
  } else if (text[0] != '\0' && text[1] == '\0') {
    char symbol = text[0];
    if (symbol >= 'a' && symbol <= 'z') {
      symbol = static_cast<char>(symbol - ('a' - 'A'));
    }
    mask = calibratedMask(symbol);
  } else {
    Serial.println(F("Character must be 0-9, A-Z, or DP."));
    return;
  }

  manualMode = true;
  segmentScanMode = false;
  segmentScanPaused = false;
  memset(frame, mask, sizeof(frame));
  writeFrame();

  Serial.print(F("Calibrated character "));
  Serial.print(text);
  Serial.print(F(" on all grids: 0x"));
  if (mask < 0x10) {
    Serial.print(F("0"));
  }
  Serial.println(mask, HEX);
}

void enterManualFrame(uint8_t selectedGrid, uint8_t mask) {
  manualMode = true;
  segmentScanMode = false;
  segmentScanPaused = false;
  grid = selectedGrid;
  memset(frame, 0, sizeof(frame));
  frame[selectedGrid] = mask;
  writeFrame();

  Serial.print(F("Manual grid "));
  Serial.print(selectedGrid + 1);
  Serial.print(F(": 0x"));
  if (mask < 0x10) {
    Serial.print(F("0"));
  }
  Serial.println(mask, HEX);
}

void printScanMask() {
  memset(frame, 0, sizeof(frame));
  frame[segmentScanGrid] = static_cast<uint8_t>(segmentScanMask);
  writeFrame();

  Serial.print(F("SCAN grid "));
  Serial.print(segmentScanGrid + 1);
  Serial.print(F(" mask 0x"));
  if (segmentScanMask < 0x10) {
    Serial.print(F("0"));
  }
  if (segmentScanMask < 0x100) {
    Serial.print(F("0"));
  }
  Serial.println(static_cast<uint8_t>(segmentScanMask), HEX);
}

void startSegmentScan(uint8_t selectedGrid) {
  manualMode = true;
  segmentScanMode = true;
  segmentScanPaused = false;
  segmentScanGrid = selectedGrid;
  segmentScanMask = 0;
  frameStartedAt = millis();
  Serial.print(F("Segment scan started on grid "));
  Serial.println(segmentScanGrid + 1);
  Serial.println(F("Range: 0x00 -> 0xFF; press Enter to pause/continue."));
  printScanMask();
}

void toggleSegmentScanPause() {
  if (!segmentScanMode) {
    return;
  }

  segmentScanPaused = !segmentScanPaused;
  if (segmentScanPaused) {
    Serial.println(F("Segment scan PAUSED. Press Enter to continue."));
  } else {
    if (segmentScanMask >= 0xFF) {
      segmentScanMask = 0;
      printScanMask();
    }
    frameStartedAt = millis();
    Serial.println(F("Segment scan CONTINUED."));
  }
}

void handleSerialCommand(char* command) {
  char* operation = strtok(command, " \t");
  if (operation == nullptr) {
    return;
  }

  if (strcmp(operation, "help") == 0) {
    printHelp();
    return;
  }

  if (strcmp(operation, "auto") == 0) {
    manualMode = false;
    segmentScanMode = false;
    segmentScanPaused = false;
    beginPhase(GRID_FULL_WALK);
    Serial.println(F("Automatic test resumed."));
    return;
  }

  if (strcmp(operation, "clear") == 0) {
    manualMode = true;
    segmentScanMode = false;
    segmentScanPaused = false;
    clearFrame();
    Serial.println(F("Manual mode: all grids off."));
    return;
  }

  if (strcmp(operation, "stop") == 0) {
    manualMode = true;
    segmentScanMode = false;
    segmentScanPaused = false;
    clearFrame();
    Serial.println(F("Segment scan stopped. Manual mode remains active."));
    return;
  }

  if (strcmp(operation, "scan") == 0) {
    char* scanType = strtok(nullptr, " \t");
    if (scanType == nullptr || strcmp(scanType, "segment") != 0) {
      Serial.println(F("Usage: scan segment [1-16]"));
      return;
    }

    unsigned long gridNumber = 1;
    char* gridText = strtok(nullptr, " \t");
    if (gridText != nullptr &&
        !parseNumber(gridText, 1, DISPLAY_GRID_COUNT, &gridNumber)) {
      Serial.println(F("Usage: scan segment [1-16]"));
      return;
    }
    startSegmentScan(static_cast<uint8_t>(gridNumber - 1));
    return;
  }

  if (strcmp(operation, "grid") == 0) {
    unsigned long gridNumber = 0;
    unsigned long mask = 0;
    bool allGrids = false;
    if (!parseGridSelector(strtok(nullptr, " \t"), &allGrids, &gridNumber) ||
        !parseNumber(strtok(nullptr, " \t"), 0, 0xFF, &mask)) {
      Serial.println(F("Usage: grid <1-16|all> <0x00-0xFF>"));
      return;
    }
    if (allGrids) {
      manualMode = true;
      segmentScanMode = false;
      segmentScanPaused = false;
      memset(frame, static_cast<uint8_t>(mask), sizeof(frame));
      writeFrame();
      Serial.print(F("Manual mask 0x"));
      if (mask < 0x10) {
        Serial.print(F("0"));
      }
      Serial.println(static_cast<uint8_t>(mask), HEX);
      return;
    }
    enterManualFrame(static_cast<uint8_t>(gridNumber - 1),
                     static_cast<uint8_t>(mask));
    return;
  }

  if (strcmp(operation, "char") == 0) {
    unsigned long gridNumber = 0;
    bool allGrids = false;
    if (!parseGridSelector(strtok(nullptr, " \t"), &allGrids, &gridNumber)) {
      Serial.println(F("Usage: char <1-16|all> <0-9|A-Z|DP>"));
      return;
    }
    const char* symbol = strtok(nullptr, " \t");
    if (allGrids) {
      showCalibratedCharacterOnAllGrids(symbol);
    } else {
      showCalibratedCharacter(static_cast<uint8_t>(gridNumber - 1), symbol);
    }
    return;
  }

  if (strcmp(operation, "section") == 0) {
    unsigned long sectionNumber = 0;
    if (!parseNumber(strtok(nullptr, " \t"), 1, 3, &sectionNumber)) {
      Serial.println(F("Usage: section <1|2|3> <text>"));
      return;
    }
    showSection(static_cast<uint8_t>(sectionNumber), strtok(nullptr, " \t"));
    return;
  }

  if (strcmp(operation, "bit") == 0) {
    unsigned long gridNumber = 0;
    unsigned long numberOfBits = 0;
    if (!parseNumber(strtok(nullptr, " \t"), 1, DISPLAY_GRID_COUNT,
                     &gridNumber) ||
        !parseNumber(strtok(nullptr, " \t"), 1, 8, &numberOfBits)) {
      Serial.println(F("Usage: bit <1-16> <1-8>"));
      return;
    }
    const uint8_t mask = static_cast<uint8_t>((1U << numberOfBits) - 1U);
    enterManualFrame(static_cast<uint8_t>(gridNumber - 1), mask);
    return;
  }

  Serial.println(F("Unknown command. Type 'help'."));
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\n' && ignoreLineFeed) {
      ignoreLineFeed = false;
      continue;
    }

    if (character == '\r' || character == '\n') {
      if (character == '\r') {
        ignoreLineFeed = true;
      }
      if (serialCommandLength > 0) {
        serialCommand[serialCommandLength] = '\0';
        Serial.print(F("RX: "));
        Serial.println(serialCommand);
        handleSerialCommand(serialCommand);
        serialCommandLength = 0;
      } else {
        toggleSegmentScanPause();
      }
      continue;
    }

    if (serialCommandLength < sizeof(serialCommand) - 1) {
      serialCommand[serialCommandLength++] = character;
    } else {
      serialCommandLength = 0;
      Serial.println(F("Command too long."));
    }
  }
}

void beginPhase(uint8_t nextPhase) {
  phase = nextPhase;
  grid = 0;
  bitCount = 0;
  phaseStartedAt = millis();
  frameStartedAt = phaseStartedAt;
  clearFrame();

  switch (phase) {
    case GRID_FULL_WALK:
      Serial.println(F("Phase 1: grid 1-16, all 8 segments (0xFF)"));
      break;
    case GRID_BIT_WALK:
      Serial.println(F("Phase 2: each grid, cumulative 1-8 segment bits"));
      break;
    case BRIGHTNESS_SWEEP:
      Serial.println(F("Phase: brightness sweep"));
      break;
    default:
      beginPhase(GRID_FULL_WALK);
      break;
  }
}

void updatePhase() {
  if (manualMode) {
    if (!segmentScanMode || segmentScanPaused) {
      return;
    }

    const uint32_t scanNow = millis();
    if (scanNow - frameStartedAt < TEST_FRAME_MS) {
      return;
    }
    frameStartedAt = scanNow;
    if (segmentScanMask < 0xFF) {
      ++segmentScanMask;
      printScanMask();
    } else {
      segmentScanPaused = true;
      Serial.println(F("Segment scan finished at 0xFF. Press Enter to restart."));
    }
    return;
  }

  const uint32_t now = millis();
  if (now - frameStartedAt < TEST_FRAME_MS) {
    return;
  }
  frameStartedAt = now;

  switch (phase) {
    case GRID_FULL_WALK:
      clearFrame();
      frame[grid] = 0xFF;
      writeFrame();
      Serial.print(F("Full grid "));
      Serial.print(grid + 1);
      Serial.println(F(": 0xFF"));
      if (++grid >= DISPLAY_GRID_COUNT) {
        beginPhase(GRID_BIT_WALK);
      }
      break;
    case GRID_BIT_WALK:
      clearFrame();
      frame[grid] = static_cast<uint8_t>((1U << bitCount) - 1U);
      writeFrame();
      Serial.print(F("Grid "));
      Serial.print(grid + 1);
      Serial.print(F(": "));
      Serial.print(bitCount + 1);
      Serial.print(F(" bit(s), 0x"));
      if (frame[grid] < 0x10) {
        Serial.print(F("0"));
      }
      Serial.println(frame[grid], HEX);
      if (++bitCount >= 8) {
        bitCount = 0;
        if (++grid >= DISPLAY_GRID_COUNT) {
          beginPhase(BRIGHTNESS_SWEEP);
        }
      }
      break;
    case BRIGHTNESS_SWEEP:
      display1.setBrightness(brightness);
      if (CHIP2_STB != CHIP1_STB) {
        display2.setBrightness(brightness);
      }
      Serial.print(F("Brightness "));
      Serial.println(brightness);
      if (++brightness > GN6932::MAX_BRIGHTNESS) {
        display1.setBrightness(DISPLAY_BRIGHTNESS);
        if (CHIP2_STB != CHIP1_STB) {
          display2.setBrightness(DISPLAY_BRIGHTNESS);
        }
        beginPhase(GRID_FULL_WALK);
      }
      break;
    default:
      beginPhase(GRID_FULL_WALK);
      break;
  }
}
}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(DISPLAY_STARTUP_DELAY_MS);

  Serial.println(F("\nGN/TA/AiP6932 dual-chip diagnostic"));
  printPins();
  Serial.println(F("Protocol: 0x40/0x44 + 0xC0 address, LSB first"));
  Serial.println(F("Both chips must use the same CLK and DIN."));
  Serial.println(F("Type 'help' for manual grid/bit commands."));
  Serial.println(F("Commands require Enter; monitor line ending is CRLF."));

  display1.begin();
  if (CHIP2_STB != CHIP1_STB) {
    display2.begin();
  }
  display1.setBrightness(DISPLAY_BRIGHTNESS);
  display1.displayOn(DISPLAY_BRIGHTNESS);
  if (CHIP2_STB != CHIP1_STB) {
    display2.setBrightness(DISPLAY_BRIGHTNESS);
    display2.displayOn(DISPLAY_BRIGHTNESS);
  }
  beginPhase(GRID_FULL_WALK);
}

void loop() {
  readSerialCommands();
  updatePhase();
}
