#pragma once

#include <Arduino.h>

// Matrix dimensions
#define ROW_COUNT 4
#define COL_COUNT 5

// Row GPIOs (outputs, HIGH idle, LOW active)
#define PIN_ROW_1 14
#define PIN_ROW_2 18
#define PIN_ROW_3 5
#define PIN_ROW_4 12

// Column GPIOs (inputs with INPUT_PULLUP)
#define PIN_COL_1 21
#define PIN_COL_2 22
#define PIN_COL_3 17
#define PIN_COL_4 16
#define PIN_COL_5 4

// Timing constants (can be overridden by build flags)
#ifndef SERIAL_BAUD
#define SERIAL_BAUD 115200
#endif

#ifndef SCAN_INTERVAL_MS
#define SCAN_INTERVAL_MS 5
#endif

#ifndef ROW_SETTLE_US
#define ROW_SETTLE_US 20
#endif

#ifndef DEBOUNCE_MS
#define DEBOUNCE_MS 5
#endif

// Total buttons
#define BUTTON_COUNT (ROW_COUNT * COL_COUNT)
