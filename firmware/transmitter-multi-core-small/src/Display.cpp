#include "Display.h"
#include "config.h"
#include "Logger.h"

void DisplayManager::begin() {
  if (!OLED_WIDTH || !OLED_HEIGHT) return;

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);

  if (OLED_RESET_PIN >= 0) {
    pinMode(OLED_RESET_PIN, OUTPUT);
    digitalWrite(OLED_RESET_PIN, HIGH);
  }

  if (!_display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    LOG_ERROR("display", "SSD1306 init failed");
    return;
  }

  _display.clearDisplay();
  _display.display();
  _enabled = true;

  LOG_INFO("display", "SSD1306 initialized (128x64)");
}

void DisplayManager::loop() {
  if (!_enabled) return;

  uint32_t now = millis();
  if ((now - _lastUpdate) < 500) return;
  _lastUpdate = now;
}

void DisplayManager::showSimple(const char* ip, float weightKg, uint8_t transportMode) {
  if (!_enabled) return;

  _display.clearDisplay();
  _display.setTextColor(SSD1306_WHITE);

  _display.setTextSize(1);
  _display.setCursor(0, 0);
  _display.printf("%s", ip);

  const char* modeText = (transportMode == TRANSPORT_ETHERNET) ? "ETH" : "WI";
  _display.setCursor(128 - (strlen(modeText) * 6), 0);
  _display.printf("%s", modeText);

  _display.drawFastHLine(0, 8, 128, SSD1306_WHITE);

  _display.setTextSize(2);
  _display.setCursor(8, 10);
  _display.printf("%.3f kg", weightKg);

  _display.display();
}

void DisplayManager::clear() {
  if (!_enabled) return;
  _display.clearDisplay();
  _display.display();
}
