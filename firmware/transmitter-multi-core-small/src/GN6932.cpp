#include "GN6932.h"

GN6932::GN6932(uint8_t clkPin, uint8_t dinPin, uint8_t stbPin)
    : _clkPin(clkPin), _dinPin(dinPin), _stbPin(stbPin) {}

void GN6932::begin() {
  pinMode(_clkPin, OUTPUT);
  pinMode(_dinPin, OUTPUT);
  pinMode(_stbPin, OUTPUT);

  digitalWrite(_clkPin, LOW);
  digitalWrite(_dinPin, LOW);
  digitalWrite(_stbPin, HIGH);

  _brightness = 0;
  _enabled = false;
  clear();
  displayOff();
}

void GN6932::select() {
  digitalWrite(_stbPin, LOW);
}

void GN6932::deselect() {
  digitalWrite(_stbPin, HIGH);
}

void GN6932::writeByte(uint8_t value) {
  for (uint8_t bit = 0; bit < 8; ++bit) {
    digitalWrite(_dinPin, (value & 0x01U) != 0U ? HIGH : LOW);
    digitalWrite(_clkPin, HIGH);
    digitalWrite(_clkPin, LOW);
    value >>= 1;
  }
}

void GN6932::sendCommand(uint8_t command) {
  select();
  writeByte(command);
  deselect();
}

void GN6932::writeRegister(uint8_t grid, uint8_t segments) {
  if (grid >= GRID_COUNT) {
    return;
  }

  sendCommand(COMMAND_WRITE_FIXED_ADDRESS);
  select();
  writeByte(static_cast<uint8_t>(COMMAND_ADDRESS | grid));
  writeByte(segments);
  deselect();
}

void GN6932::clear() {
  const uint8_t blank[GRID_COUNT] = {};
  writeGrids(blank);
}

void GN6932::displayOn(uint8_t brightness) {
  _brightness = brightness > MAX_BRIGHTNESS ? MAX_BRIGHTNESS : brightness;
  _enabled = true;
  sendCommand(static_cast<uint8_t>(COMMAND_DISPLAY_CONTROL | 0x08U |
                                   _brightness));
}

void GN6932::displayOff() {
  _enabled = false;
  sendCommand(COMMAND_DISPLAY_CONTROL);
}

void GN6932::setBrightness(uint8_t brightness) {
  _brightness = brightness > MAX_BRIGHTNESS ? MAX_BRIGHTNESS : brightness;
  sendCommand(static_cast<uint8_t>(COMMAND_DISPLAY_CONTROL |
                                   (_enabled ? 0x08U : 0x00U) | _brightness));
}

void GN6932::setGrid(uint8_t grid, uint8_t segments) {
  writeRegister(grid, segments);
}

void GN6932::writeGrids(const uint8_t* segments, uint8_t startGrid,
                        uint8_t count) {
  if (segments == nullptr || startGrid >= GRID_COUNT || count == 0) {
    return;
  }

  const uint8_t available = GRID_COUNT - startGrid;
  if (count > available) {
    count = available;
  }

  sendCommand(COMMAND_WRITE_AUTO_INCREMENT);
  select();
  writeByte(static_cast<uint8_t>(COMMAND_ADDRESS | startGrid));
  for (uint8_t i = 0; i < count; ++i) {
    writeByte(segments[i]);
  }
  deselect();
}

void GN6932::setAllSegments() {
  const uint8_t allOn[GRID_COUNT] = {
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  writeGrids(allOn);
}
