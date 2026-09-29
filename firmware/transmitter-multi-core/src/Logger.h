#ifndef LOGGER_H
#define LOGGER_H

#include <Arduino.h>

#ifndef LOG_LEVEL
#define LOG_LEVEL LOG_LEVEL_INFO
#endif

#define LOG_LEVEL_ERROR 1
#define LOG_LEVEL_WARN 2
#define LOG_LEVEL_INFO 3
#define LOG_LEVEL_DEBUG 4

#if LOG_LEVEL >= LOG_LEVEL_DEBUG
#define LOG_DEBUG(domain, fmt, ...) Serial.printf("[%lu] [DEBUG] [%s] " fmt "\n", (unsigned long)(millis()/1000), domain, ##__VA_ARGS__)
#else
#define LOG_DEBUG(domain, fmt, ...)
#endif

#if LOG_LEVEL >= LOG_LEVEL_INFO
#define LOG_INFO(domain, fmt, ...) Serial.printf("[%lu] [INFO] [%s] " fmt "\n", (unsigned long)(millis()/1000), domain, ##__VA_ARGS__)
#else
#define LOG_INFO(domain, fmt, ...)
#endif

#if LOG_LEVEL >= LOG_LEVEL_WARN
#define LOG_WARN(domain, fmt, ...) Serial.printf("[%lu] [WARN] [%s] " fmt "\n", (unsigned long)(millis()/1000), domain, ##__VA_ARGS__)
#else
#define LOG_WARN(domain, fmt, ...)
#endif

#if LOG_LEVEL >= LOG_LEVEL_ERROR
#define LOG_ERROR(domain, fmt, ...) Serial.printf("[%lu] [ERROR] [%s] " fmt "\n", (unsigned long)(millis()/1000), domain, ##__VA_ARGS__)
#else
#define LOG_ERROR(domain, fmt, ...)
#endif

class Logger {
 public:
  static void begin(uint32_t baud = 115200) {
    Serial.begin(baud);
  }
};

#endif
