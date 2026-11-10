#pragma once

#include <Arduino.h>
#include "config.h"

class Logger {
public:
    void begin(unsigned long baud) {
        Serial.begin(baud);
    }

    void logPress(unsigned long ts, uint8_t buttonId) {
        Serial.print("{\"ts\":");
        Serial.print(ts);
        Serial.print(",\"btn\":");
        Serial.print(buttonId);
        Serial.print(",\"event\":\"pressed\"}\n");
    }

    void logRelease(unsigned long ts, uint8_t buttonId) {
        Serial.print("{\"ts\":");
        Serial.print(ts);
        Serial.print(",\"btn\":");
        Serial.print(buttonId);
        Serial.print(",\"event\":\"released\"}\n");
    }
};
