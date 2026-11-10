#pragma once

#include <Arduino.h>

#ifndef SERIAL_BAUD
#define SERIAL_BAUD 115200
#endif

#ifndef CLK_PIN
#define CLK_PIN 18
#endif

#ifndef DIN_PIN
#define DIN_PIN 19
#endif

// Both controllers share GPIO 23 for STB in the current wiring.
#ifndef CHIP1_STB
#define CHIP1_STB 23
#endif

#ifndef CHIP2_STB
#define CHIP2_STB 23
#endif

#ifndef DISPLAY_BRIGHTNESS
#define DISPLAY_BRIGHTNESS 1
#endif

#ifndef ENABLE_FULL_CURRENT_TEST
#define ENABLE_FULL_CURRENT_TEST 0
#endif

#define DISPLAY_GRID_COUNT 16
#define TEST_STEP_MS 1000UL
#define TEST_FRAME_MS 1000UL
#define DISPLAY_STARTUP_DELAY_MS 1500UL

// Segment calibration for the installed display board.
#define SEGMENT_A 0x20
#define SEGMENT_B 0x80
#define SEGMENT_C 0x01
#define SEGMENT_D 0x02
#define SEGMENT_E 0x08
#define SEGMENT_F 0x10
#define SEGMENT_G 0x40
#define SEGMENT_DP 0x04

#if (CLK_PIN == DIN_PIN) || (CLK_PIN == CHIP1_STB) || \
    (CLK_PIN == CHIP2_STB) || (DIN_PIN == CHIP1_STB) || \
    (DIN_PIN == CHIP2_STB)
#error "CLK, DIN, and STB pins must be unique unless both STB pins are shared"
#endif
