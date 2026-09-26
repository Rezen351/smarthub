# ESP32 + W5500 Ethernet Ping Test

This firmware is a minimal test to verify an ESP32-based board can communicate with a laptop over LAN via a W5500 module. The goal is ping connectivity only; there is no web server.

Supported boards:
- `esp32s3-ethernet` — ESP32-S3 DevKitC-1
- `esp32dev` — classic ESP32 DevKit

## 1. Hardware

### 1.1 Required parts

| Component | Notes |
|-----------|-------|
| ESP32-S3 DevKitC-1 or ESP32 DevKit | USB-C / Micro-USB |
| W5500 Ethernet module | Hardware SPI |
| Ethernet cable | Straight-through cable |
| Router / switch | Or connect directly to laptop |
| Jumper wires | Dupont Female-to-Female |

### 1.2 Wiring — ESP32-S3

Use the recommended ESP32-S3 SPI pins for W5500.

| W5500 pin | ESP32-S3 GPIO | Function |
|-----------|---------------|----------|
| SCK       | 12            | SPI clock |
| MOSI      | 11            | Master out |
| MISO      | 13            | Master in |
| CS        | 10            | Chip select |
| 3.3 V     | 3V3           | Power |
| GND       | GND           | Ground |
| RST       | 9             | Hardware reset |
| INT       | -1            | Unused |

### 1.3 Wiring — ESP32 classic

Use the standard ESP32 SPI pins for W5500.

| W5500 pin | ESP32 GPIO | Function |
|-----------|------------|----------|
| SCK       | 18         | SPI clock |
| MOSI      | 23         | Master out |
| MISO      | 19         | Master in |
| CS        | 5          | Chip select |
| 3.3 V     | 3V3        | Power |
| GND       | GND        | Ground |
| RST       | -1         | Unused, tied high |
| INT       | -1         | Unused |

> Important: use a common ground between the ESP32 and W5500.

## 2. Network

Static IP configuration:

- ESP32 IP: `192.168.1.100`
- Gateway: `192.168.1.1`
- Subnet: `255.255.255.0`

Your laptop must be on the same subnet, for example `192.168.1.50`.

If you connect the ESP32 directly to a laptop, set the laptop Ethernet adapter to static:
- IP: `192.168.1.50`
- Subnet: `255.255.255.0`
- Gateway: `192.168.1.1`

## 3. Flash the firmware

### 3.1 ESP32-S3

```bash
cd firmware/esp32s3-ethernet
pio run -e esp32s3-ethernet -t upload
```

### 3.2 ESP32 classic

```bash
cd firmware/esp32s3-ethernet
pio run -e esp32dev -t upload
```

Monitor serial output:

```bash
pio device monitor -e esp32s3-ethernet
```

or

```bash
pio device monitor -e esp32dev
```

## 4. Test the connection

### 4.1 Serial Monitor check

After flashing, open the serial monitor. You should see something like:

```
[setup] Initializing Ethernet...
[setup] Ethernet.begin attempt 1
[setup] hardwareStatus=1
[setup] linkStatus=ON
[setup] Ethernet link is UP
[setup] IP Address: 192.168.1.100
[setup] Gateway: 192.168.1.1
[setup] Subnet: 255.255.255.0
[setup] MAC: deadbeeffeed
[setup] Ready for ping test
```

If `linkStatus` stays `OFF` after retries, check:
- W5500 RST wiring
- W5500 power
- SPI wiring
- cable/link LED

### 4.2 Ping

```bash
ping 192.168.1.100
```

Expected result: replies from `192.168.1.100`.

If ping fails:
- check the cable
- check link LED on W5500
- check Serial Monitor for Ethernet link status and IP address
- ensure laptop and ESP32 are on the same subnet
- temporarily disable firewall on the laptop
- verify no other device uses `192.168.1.100`

## 5. Current behavior

This firmware only initializes Ethernet and prints the assigned IP. There is no web server or TCP service beyond what the W5500 stack needs internally for ping.
