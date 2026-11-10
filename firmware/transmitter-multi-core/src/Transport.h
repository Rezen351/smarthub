#ifndef TRANSPORT_H
#define TRANSPORT_H

#include <Arduino.h>

enum class TransportState : uint8_t {
  WiFi,
  Ethernet,
  Switching
};

#endif
