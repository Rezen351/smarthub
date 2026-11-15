#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

class DisplayManager {
 public:
  void begin();
  void loop();

  void showSimple(const char* ip, float weightKg, uint8_t transportMode);
  void clear();

  bool enabled() { return _enabled; }
  void setEnabled(bool e) { _enabled = e; }

 private:
  Adafruit_SSD1306 _display;
  bool           _enabled = true;
  uint32_t       _lastUpdate = 0;
};

#endif
