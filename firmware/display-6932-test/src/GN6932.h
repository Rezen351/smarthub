#pragma once

#include <Arduino.h>

class GN6932 {
public:
  static constexpr uint8_t GRID_COUNT = 16;
  static constexpr uint8_t MAX_BRIGHTNESS = 7;

  GN6932(uint8_t clkPin, uint8_t dinPin, uint8_t stbPin);

  void begin();
  void clear();
  void displayOn(uint8_t brightness = MAX_BRIGHTNESS);
  void displayOff();
  void setBrightness(uint8_t brightness);
  void setGrid(uint8_t grid, uint8_t segments);
  void writeGrids(const uint8_t* segments, uint8_t startGrid = 0,
                  uint8_t count = GRID_COUNT);
  void setAllSegments();

private:
  static constexpr uint8_t COMMAND_WRITE_AUTO_INCREMENT = 0x40;
  static constexpr uint8_t COMMAND_WRITE_FIXED_ADDRESS = 0x44;
  static constexpr uint8_t COMMAND_DISPLAY_CONTROL = 0x80;
  // GN/TA/AiP6932 grid registers are addressed from 0xC0 through 0xCF.
  static constexpr uint8_t COMMAND_ADDRESS = 0xC0;

  void sendCommand(uint8_t command);
  void writeRegister(uint8_t grid, uint8_t segments);
  void writeByte(uint8_t value);
  void select();
  void deselect();

  uint8_t _clkPin;
  uint8_t _dinPin;
  uint8_t _stbPin;
  uint8_t _brightness = 7;
  bool _enabled = false;
};
