#pragma once

#include <Arduino.h>
#include "config.h"

enum class ButtonEvent : uint8_t {
    None,
    Pressed,
    Released
};

struct Event {
    ButtonEvent type;
    uint8_t buttonId;
};

class MatrixScanner {
public:
    MatrixScanner();

    void begin();
    Event update();

private:
    uint8_t rowPins[ROW_COUNT];
    uint8_t colPins[COL_COUNT];

    uint8_t lastRawState[BUTTON_COUNT];
    uint8_t stableState[BUTTON_COUNT];
    unsigned long lastChangeTime[BUTTON_COUNT];

    uint8_t activeRow;

    void setRowActive(uint8_t rowIndex);
    void setRowIdle();
    uint8_t readColumns();
    uint8_t getButtonId(uint8_t row, uint8_t col);
};
