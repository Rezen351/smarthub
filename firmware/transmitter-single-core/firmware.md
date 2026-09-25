# Weight Transmitter (1 Core) — Firmware Design Document

> **E-Tani Smart Hub · Firmware v1.2 (Single Core)**
> Target: ESP32-WROOM-32, ESP32-S3, ESP32-C3-MINI
> Build system: PlatformIO · framework-arduinoespressif32 6.6.0

---

## 1. Overview

The **Weight Transmitter (1 Core)** is a single-core variant of the Weight Transmitter. It provides the same functionality as the dual-core version but runs all tasks sequentially in `loop()` without FreeRTOS task pinning or inter-core mutexes.

Features:
- HX711 load cell acquisition
- Modbus TCP server (port 502)
- Captive portal web UI
- WiFi: WPA2-PSK and WPA2-Enterprise
- NVS persistence

---

## 2. Hardware

Same as the dual-core version. See the original `firmware.md` for the BOM and pin assignments.

---

## 3. Architecture

### 3.1 Single-Core Layout

All tasks run sequentially in `loop()`:

```
loop() [core 0]
  +-- gScale.loop()          every 30 ms (SCALE_SAMPLE_MS)
  +-- gPortal.handleClient() every iteration (HTTP + DNS)
  +-- gWifi.loop()           every 5 s (STA reconnect)
  +-- gModbus.loop()         every 100 ms (MODBUS_POLL_MS)
```

No FreeRTOS tasks are created. No mutexes are needed because all code runs on a single core.

---

## 4. Key Differences from Dual-Core Version

| Aspect | Dual-Core | Single-Core |
|--------|-----------|-------------|
| Task creation | `xTaskCreatePinnedToCore` | None |
| SharedState | Mutex-protected | Plain struct (no mutex) |
| SettingsStore | Recursive NVS mutex | Plain Preferences |
| Scale loop | Core 0 task | Called from `loop()` |
| Network loop | Core 1 task | Called from `loop()` |
| Timing | Hardware timer | `millis()` polling |

---

## 5. Build & Flash

```bash
cd "firmware/transmitter-single-core"
pio run
pio run -t upload && pio device monitor --baud 115200
pio run -t uploadfs
```

---

## 6. File Structure

```
firmware/transmitter-single-core/
+-- platformio.ini
+-- partitions.csv
+-- data/
|   +-- index.html
|   +-- css/style.css
|   +-- js/app.js
|   +-- favicon.svg
|   +-- logo.svg
+-- src/
    +-- main.ino
    +-- config.h
    +-- SharedState.h/.cpp
    +-- Settings.h/.cpp
    +-- Scale.h/.cpp
    +-- WifiManager.h/.cpp
    +-- ModbusServer.h/.cpp
    +-- WebPortal.h/.cpp
```
