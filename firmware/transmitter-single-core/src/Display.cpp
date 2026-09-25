#include "Display.h"
#include "config.h"

void DisplayManager::begin() {
  if (!OLED_WIDTH || !OLED_HEIGHT) return;

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);

  if (OLED_RESET_PIN >= 0) {
    pinMode(OLED_RESET_PIN, OUTPUT);
    digitalWrite(OLED_RESET_PIN, HIGH);
  }

  if (!_display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("[display] SSD1306 init failed");
    return;
  }

  _display.clearDisplay();
  _display.display();
  _enabled = true;

  Serial.println("[display] SSD1306 initialized (128x64)");
}

void DisplayManager::loop() {
  if (!_enabled) return;

  uint32_t now = millis();
  if ((now - _lastUpdate) < 500) return;
  _lastUpdate = now;
}

void DisplayManager::showWeight(float weightG, float stableG) {
  if (!_enabled) return;

  _display.clearDisplay();
  _display.setTextSize(1);
  _display.setTextColor(SSD1306_WHITE);
  _display.setCursor(0, 0);
  _display.printf("Weight: %.1f g", weightG);
  _display.setCursor(0, 16);
  _display.printf("Stable: %.1f g", stableG);
  _display.display();
}

void DisplayManager::showStatus(const char* transport, const char* ip) {
  if (!_enabled) return;

  _display.clearDisplay();
  _display.setTextSize(1);
  _display.setTextColor(SSD1306_WHITE);
  _display.setCursor(0, 0);
  _display.printf("Transport: %s", transport);
  _display.setCursor(0, 16);
  _display.printf("IP: %s", ip);
  _display.display();
}

void DisplayManager::clear() {
  if (!_enabled) return;
  _display.clearDisplay();
  _display.display();
}
