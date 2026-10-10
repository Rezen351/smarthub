#include "MatrixScanner.h"

#ifdef ESP32S3

MatrixScanner::MatrixScanner() : activeRow(0) {
    rowPins[0] = BUTTON_ROW_1_PIN;
    rowPins[1] = BUTTON_ROW_2_PIN;
    rowPins[2] = BUTTON_ROW_3_PIN;
    rowPins[3] = BUTTON_ROW_4_PIN;
    colPins[0] = BUTTON_COL_1_PIN;
    colPins[1] = BUTTON_COL_2_PIN;
    colPins[2] = BUTTON_COL_3_PIN;
    colPins[3] = BUTTON_COL_4_PIN;
    colPins[4] = BUTTON_COL_5_PIN;
}

void MatrixScanner::begin() {
    for (uint8_t r = 0; r < ROW_COUNT; r++) {
        pinMode(rowPins[r], OUTPUT);
        digitalWrite(rowPins[r], HIGH);
    }
    for (uint8_t c = 0; c < COL_COUNT; c++) {
        pinMode(colPins[c], INPUT_PULLUP);
    }
    for (uint8_t i = 0; i < BUTTON_COUNT; i++) {
        lastRawState[i] = HIGH;
        stableState[i] = HIGH;
        lastChangeTime[i] = 0;
    }
}

void MatrixScanner::setRowActive(uint8_t rowIndex) {
    digitalWrite(rowPins[rowIndex], LOW);
}

void MatrixScanner::setRowIdle() {
    for (uint8_t r = 0; r < ROW_COUNT; r++) {
        digitalWrite(rowPins[r], HIGH);
    }
}

uint8_t MatrixScanner::readColumns() {
    uint8_t bits = 0;
    for (uint8_t c = 0; c < COL_COUNT; c++) {
        bits |= (digitalRead(colPins[c]) == LOW) ? (1 << c) : 0;
    }
    return bits;
}

uint8_t MatrixScanner::getButtonId(uint8_t row, uint8_t col) {
    return row * COL_COUNT + col;
}

MatrixEvent MatrixScanner::update() {
    MatrixEvent ev = {ButtonEvent::None, 255};

    for (uint8_t r = 0; r < ROW_COUNT; r++) {
        setRowIdle();
        setRowActive(r);
        delayMicroseconds(ROW_SETTLE_US);

        uint8_t colBits = readColumns();

        for (uint8_t c = 0; c < COL_COUNT; c++) {
            uint8_t idx = getButtonId(r, c);
            uint8_t raw = (colBits & (1 << c)) ? LOW : HIGH;

            if (raw != lastRawState[idx]) {
                lastRawState[idx] = raw;
                lastChangeTime[idx] = millis();
            }

            if (millis() - lastChangeTime[idx] >= DEBOUNCE_MS) {
                if (stableState[idx] != raw) {
                    uint8_t prevStable = stableState[idx];
                    stableState[idx] = raw;

                    if (ev.type == ButtonEvent::None) {
                        if (prevStable == HIGH && stableState[idx] == LOW) {
                            ev.type = ButtonEvent::Pressed;
                            ev.buttonId = idx;
                        } else if (prevStable == LOW && stableState[idx] == HIGH) {
                            ev.type = ButtonEvent::Released;
                            ev.buttonId = idx;
                        }
                    }
                }
            }
        }
    }

    setRowIdle();
    return ev;
}

#endif // ESP32S3
