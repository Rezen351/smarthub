#include <Arduino.h>

namespace {
constexpr uint8_t HX711_DOUT_PIN = 13;
constexpr uint8_t HX711_SCK_PIN = 14;
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t NO_DATA_LOG_INTERVAL_MS = 1000;

uint32_t sampleCount = 0;
uint32_t lastNoDataLogMs = 0;
int32_t firstRaw = 0;
bool firstRawCaptured = false;

bool readHx711Raw(int32_t& raw) {
  if (digitalRead(HX711_DOUT_PIN) != LOW) {
    return false;
  }

  uint32_t value = 0;
  noInterrupts();
  for (uint8_t bit = 0; bit < 24; ++bit) {
    digitalWrite(HX711_SCK_PIN, HIGH);
    delayMicroseconds(1);
    value = (value << 1U) | static_cast<uint32_t>(digitalRead(HX711_DOUT_PIN));
    digitalWrite(HX711_SCK_PIN, LOW);
    delayMicroseconds(1);
  }

  // Pulse 25 selects channel A with gain 128 for the next conversion.
  digitalWrite(HX711_SCK_PIN, HIGH);
  delayMicroseconds(1);
  digitalWrite(HX711_SCK_PIN, LOW);
  interrupts();

  if ((value & 0x00800000UL) != 0U) {
    value |= 0xFF000000UL;
  }
  raw = static_cast<int32_t>(value);
  return true;
}
}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD);

  pinMode(HX711_SCK_PIN, OUTPUT);
  digitalWrite(HX711_SCK_PIN, LOW);
  pinMode(HX711_DOUT_PIN, INPUT);

  Serial.println();
  Serial.println(F("[INFO] [hx711-test] raw data test started"));
  Serial.printf("[INFO] [hx711-test] DOUT=GPIO%u SCK=GPIO%u baud=%lu\n",
                HX711_DOUT_PIN, HX711_SCK_PIN,
                static_cast<unsigned long>(SERIAL_BAUD));
  Serial.println(F("[INFO] [hx711-test] apply and remove weight; raw and delta must change"));
}

void loop() {
  int32_t raw = 0;
  if (readHx711Raw(raw)) {
    if (!firstRawCaptured) {
      firstRaw = raw;
      firstRawCaptured = true;
    }

    ++sampleCount;
    Serial.printf("[DATA] sample=%lu raw=%ld delta=%ld\n",
                  static_cast<unsigned long>(sampleCount),
                  static_cast<long>(raw),
                  static_cast<long>(raw - firstRaw));
    return;
  }

  const uint32_t now = millis();
  if ((now - lastNoDataLogMs) >= NO_DATA_LOG_INTERVAL_MS) {
    lastNoDataLogMs = now;
    Serial.printf("[WARN] [hx711-test] no data; DOUT=%u check VCC, GND, GPIO13, and GPIO14\n",
                  static_cast<unsigned>(digitalRead(HX711_DOUT_PIN)));
  }
  yield();
}
