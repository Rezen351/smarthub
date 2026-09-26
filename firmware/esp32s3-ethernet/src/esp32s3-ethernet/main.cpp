#include "SPI.h"
#include <EthernetENC.h>

#define SCK       12
#define SS        10
#define MOSI      11
#define MISO      13
#define SPI_FREQ  32000000
#define W5500_RST 9

static const IPAddress IP_ADDR(192, 168, 1, 100);
static const IPAddress GATEWAY(192, 168, 1, 1);
static const IPAddress SUBNET(255, 255, 255, 0);
static const byte MAC_ADDR[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED};

static void resetW5500() {
  pinMode(W5500_RST, OUTPUT);
  digitalWrite(W5500_RST, LOW);
  delay(10);
  digitalWrite(W5500_RST, HIGH);
  delay(50);
}

static const char *linkStatusText(int status) {
  switch (status) {
    case LinkOFF:
      return "OFF";
    case LinkON:
      return "ON";
    case Unknown:
      return "UNKNOWN";
    default:
      return "INVALID";
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(1);
  }

  resetW5500();

  SPI.begin(SCK, MISO, MOSI, SS);
  SPI.setFrequency(SPI_FREQ);
  Ethernet.init(SS);

  Serial.println(F("\n[setup] Initializing Ethernet..."));

  for (int attempt = 1; attempt <= 3; attempt++) {
    Serial.print(F("[setup] Ethernet.begin attempt "));
    Serial.println(attempt);

    Ethernet.begin(MAC_ADDR, IP_ADDR, GATEWAY, SUBNET);
    delay(500);

    int hardware = Ethernet.hardwareStatus();
    Serial.print(F("[setup] hardwareStatus="));
    Serial.println(hardware);

    if (hardware == EthernetNoHardware) {
      Serial.println(F("[setup] ERROR: No Ethernet hardware detected"));
      while (true) {
        delay(1000);
      }
    }

    int link = Ethernet.linkStatus();
    Serial.print(F("[setup] linkStatus="));
    Serial.println(linkStatusText(link));

    if (link == LinkON) {
      Serial.println(F("[setup] Ethernet link is UP"));
      break;
    }

    Serial.println(F("[setup] Link not ready, retrying..."));
    delay(1000);
  }

  Serial.print(F("[setup] IP Address: "));
  Serial.println(Ethernet.localIP());
  Serial.print(F("[setup] Gateway: "));
  Serial.println(Ethernet.gatewayIP());
  Serial.print(F("[setup] Subnet: "));
  Serial.println(Ethernet.subnetMask());
  Serial.print(F("[setup] MAC: "));
  for (byte i = 0; i < 6; i++) {
    if (i) Serial.print(':');
    if (MAC_ADDR[i] < 0x10) Serial.print('0');
    Serial.print(String(MAC_ADDR[i], HEX));
  }
  Serial.println();
  Serial.println(F("[setup] Ready for ping test\n"));
}

void loop() {
}

