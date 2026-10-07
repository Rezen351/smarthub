#include <Arduino.h>
#include "config.h"
#include "Logger.h"
#include "MatrixScanner.h"

MatrixScanner scanner;
Logger logger;

void setup() {
    logger.begin(SERIAL_BAUD);
    scanner.begin();
}

void loop() {
    Event ev = scanner.update();

    if (ev.type == ButtonEvent::Pressed) {
        logger.logPress(millis(), ev.buttonId);
    } else if (ev.type == ButtonEvent::Released) {
        logger.logRelease(millis(), ev.buttonId);
    }

    delay(SCAN_INTERVAL_MS);
}
