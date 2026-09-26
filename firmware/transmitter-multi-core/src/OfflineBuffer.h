#ifndef OFFLINE_BUFFER_H
#define OFFLINE_BUFFER_H

#include <Arduino.h>
#include <SPIFFS.h>

class OfflineBuffer {
 public:
  OfflineBuffer() = default;

  bool begin() {
    if (_fsOk) return true;
    _fsOk = SPIFFS.begin(false, "/spiffs", 10, "spiffs");
    return _fsOk;
  }

  bool append(const String& payload) {
    if (!_fsOk) return false;
    if (_size >= _maxSize) return false;

    File file = SPIFFS.open("/offline.jsonl", "a");
    if (!file) return false;

    size_t len = payload.length();
    if (len > _maxEntryBytes) len = _maxEntryBytes;

    file.write((const uint8_t*)payload.c_str(), len);
    file.write('\n');
    file.close();

    _size++;
    return true;
  }

  bool pop(String& out) {
    if (!_fsOk || _size == 0) return false;

    File file = SPIFFS.open("/offline.jsonl", "r");
    if (!file) return false;

    char line[_maxEntryBytes + 1];
    size_t len = 0;
    while (file.available() && len < sizeof(line) - 1) {
      char c = (char)file.read();
      if (c == '\n') break;
      line[len++] = c;
    }
    line[len] = '\0';
    file.close();

    if (len == 0) return false;

    out = String(line);
    _size--;

    if (_size == 0) {
      SPIFFS.remove("/offline.jsonl");
      return true;
    }

    File tmp = SPIFFS.open("/offline_tmp.jsonl", "w");
    if (!tmp) return true;

    file = SPIFFS.open("/offline.jsonl", "r");
    if (!file) return true;

    bool skipped = false;
    while (file.available()) {
      char c = (char)file.read();
      if (!skipped) {
        while (c != '\n' && file.available()) {
          c = (char)file.read();
        }
        if (c == '\n') {
          skipped = true;
          continue;
        }
      }
      tmp.write((uint8_t*)&c, 1);
    }
    file.close();
    tmp.close();

    SPIFFS.remove("/offline.jsonl");
    SPIFFS.rename("/offline_tmp.jsonl", "/offline.jsonl");

    return true;
  }

  size_t size() const { return _size; }
  bool full() const { return _size >= _maxSize; }
  bool mounted() const { return _fsOk; }

 private:
  bool _fsOk = false;
  size_t _size = 0;
  static constexpr size_t _maxSize = 50;
  static constexpr size_t _maxEntryBytes = 200;
};

#endif
