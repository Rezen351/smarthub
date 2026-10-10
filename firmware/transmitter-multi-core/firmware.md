# Weight Transmitter — Firmware Design Document

> **E-Tani Smart Hub · Firmware v1.5**
> Target: ESP32-S3 (dual-core Xtensa LX7, 240 MHz, native USB)
> Build system: PlatformIO · framework-arduinoespressif32 6.6.0 · RTOS: FreeRTOS 10.4

---

## 1. Overview

The **Weight Transmitter** is an autonomous edge device that:

1. Acquires mass data from a strain-gauge load cell via an **HX711** 24-bit ADC.
2. Publishes real-time weight over **Modbus TCP** on both **WiFi** and **Ethernet** simultaneously (dual-transport), acting as a Modbus server on port 502.
3. Provides a **captive-portal web UI** for device configuration and calibration — reachable **only via WiFi Soft-AP** (`192.168.4.1`), regardless of Ethernet or STA state.
4. Runs in **dual WiFi mode** simultaneously: Soft-AP (configuration hotspot) + STA uplink (user network), both always-on.
5. Uses **W5500 Ethernet** for Modbus TCP only; portal access and WiFi STA remain independent.

The design is intentionally **protocol-agnostic at the top level**: the `SharedState` bus decouples sensor acquisition from transport, allowing additional protocols (Modbus RTU, OPC-UA, etc.) to be added as independent modules in future iterations without touching the sensor or portal code.

---

## 2. Hardware

### 2.1 Minimum Bill of Materials

| Component | Part | Notes |
|-----------|------|-------|
| MCU | ESP32-WROOM-32 (DevKit V1) | Dual-core, built-in WiFi/BT |
| MCU | ESP32-S3 DevKitC-1 (ESP32 v4) | Drop-in replacement, same GPIO map |
| MCU | ESP32-C3-MINI (DevKitM-1) | Single-core RISC-V, WiFi only, compact |
| MCU | ESP32-WROOM-32U | U.FL antenna variant, same as DevKit V1 |
| Load cell ADC | HX711 module | 24-bit sigma-delta, 10/80 Hz |
| Load cell | Any strain-gauge (1-200 kg range) | 4-wire Wheatstone bridge |
| Power supply | 5 V / 1 A USB or regulated | HX711 may use 3.3 V or 5 V VCC |

### 2.1 Minimum Bill of Materials

| Component | Part | Notes |
|-----------|------|-------|
| MCU | ESP32-S3 DevKitC-1 | Dual-core Xtensa LX7, 240 MHz, native USB, WiFi/BT |
| Load cell ADC | HX711 module | 24-bit sigma-delta, 10/80 Hz |
| Load cell | Any strain-gauge (1-200 kg range) | 4-wire Wheatstone bridge |
| Ethernet | W5500 module (hardware SPI) | Modbus TCP over Ethernet |
| Display | GN/TA/AiP6932 7-segment display | Weight, unit price, and total price |
| Power supply | 5 V / 1 A USB or regulated | HX711 may use 3.3 V or 5 V VCC |

### 2.2 Pin Assignment

#### ESP32-S3 DevKitC-1 N16R8

This is the canonical assignment for the N16R8 module. GPIO 26–37 are
reserved by Octal flash/PSRAM and are not application GPIO. GPIO 20 is kept free for native USB. GPIO 19 is assigned to the validated
6932 DIN wiring. GPIO 0/3/45/46 are kept free for boot strapping,
and GPIO 43/44 remain available for the UART0 console.

```
GPIO       Signal             Connected to
---------- ------------------ -------------------------------------
GPIO 12    W5500_SCK          W5500 SPI clock
GPIO 13    W5500_MISO         W5500 SPI MISO
GPIO 11    W5500_MOSI         W5500 SPI MOSI
GPIO 10    W5500_CS           W5500 chip select
GPIO 9     W5500_RST          W5500 hardware reset
GPIO 14    LOADCELL_DOUT      HX711 DT / DOUT
GPIO 15    LOADCELL_SCK       HX711 PD_SCK
GPIO 16    OLED_SDA           SSD1306 SDA
GPIO 17    OLED_SCL           SSD1306 SCL
GPIO 1     MATRIX_ROW_1       Button matrix row 1
GPIO 2     MATRIX_ROW_2       Button matrix row 2
GPIO 4     MATRIX_ROW_3       Button matrix row 3
GPIO 5     MATRIX_ROW_4       Button matrix row 4
GPIO 6     MATRIX_COL_1       Button matrix column 1
GPIO 7     MATRIX_COL_2       Button matrix column 2
GPIO 8     MATRIX_COL_3       Button matrix column 3
GPIO 39    MATRIX_COL_4       Button matrix column 4 (JTAG-capable)
GPIO 40    MATRIX_COL_5       Button matrix column 5 (JTAG-capable)
GPIO 38    STATUS_RGB_LED     Built-in addressable RGB LED (single data pin)
GPIO 18    DISPLAY6932_CLK    GN/TA/AiP6932 CLK, shared
GPIO 19    DISPLAY6932_DIN    GN/TA/AiP6932 DIN, shared
GPIO 21    DISPLAY6932_STB    GN/TA/AiP6932 STB, shared by both chips
```

Power the ESP32-S3 from a stable 5 V rail. Power the W5500 and 6932
controller/display rail according to their modules, but keep all grounds
common. The ESP32 GPIO signals must remain at 3.3 V logic; the 6932 inputs
must use a level shifter if their input high threshold requires it.

GPIO 39/40 are usable during normal firmware execution, but an external JTAG
debugger cannot use them simultaneously. GPIO 38 is assigned exclusively to
the DevKitC-1 built-in addressable RGB LED. Do not connect an external LED to
this pin and do not drive it as a normal single-color LED; use an addressable
RGB LED driver with the correct one-wire timing.

The selected N16R8 DevKitC-1 variant must have its built-in RGB LED data line
on GPIO 38. Some ESP32-S3 DevKit revisions use GPIO 48 instead, so verify the
silkscreen/schematic before assembly. If the physical board uses GPIO 48,
change both `STATUS_RGB_LED_PIN` in `src/config.h` and this table together.

#### N16R8 reservation rules

| GPIO | Status | Reason |
|------|--------|--------|
| 0, 3, 45, 46 | Reserved | Boot strapping |
| 20 | Reserved | Native USB D+ |
| 26–37 | Forbidden | Octal flash/PSRAM |
| 38 | Assigned | Built-in addressable RGB LED data line |
| 39–42 | Assigned with caution | JTAG-capable; 39/40 used by matrix |
| 43, 44 | Reserved | UART0 console/programming |
| 48 | Reserved | Keep free for board LED/debug variants |

#### ESP32 / ESP32-DOIT-V1 (esp32dev)

```
ESP32 GPIO | Signal        | Connected to
-----------+---------------+-------------------------------
GPIO 14    | W5500_SCK     | W5500 SPI clock
GPIO 13    | W5500_MISO    | W5500 SPI MISO
GPIO 12    | W5500_MOSI    | W5500 SPI MOSI
GPIO 15    | W5500_CS      | W5500 SPI chip select
GPIO 16    | W5500_RST     | W5500 hardware reset
GPIO 4     | LOADCELL_DOUT | HX711 DT  (data out)
GPIO 5     | LOADCELL_SCK  | HX711 PD_SCK (clock)
GPIO 21    | OLED_SDA      | SSD1306 SDA (I2C)
GPIO 22    | OLED_SCL      | SSD1306 SCL (I2C)
```

#### Bus topology

##### ESP32-S3 N16R8

| Bus | Peripheral | GPIO | Mode | Notes |
|-----|-----------|------|------|-------|
| Hardware SPI | W5500 | 12, 11, 13, 10, 9 | SPI | See pin assignment per board above |
| Software GPIO | HX711 | 14, 15 | Bit-banged | Uses `HX711` library; does **not** use SPI peripheral |
| I2C (Wire) | SSD1306 | 16, 17 | I2C | `Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN)` |
| GPIO | Button matrix | rows 1, 2, 4, 5; columns 6, 7, 8, 39, 40 | 4x5 scan |
| GPIO | GN/TA/AiP6932 | CLK 18, DIN 19, STB 21 | 3-wire serial, shared STB |
| GPIO | Built-in RGB LED | 38 | Addressable one-wire data output |

##### ESP32 / ESP32-DOIT-V1 (esp32dev)

| Bus | Peripheral | GPIO | Mode | Notes |
|-----|-----------|------|------|-------|
| Hardware SPI | W5500 | 14, 12, 13, 15, 16 | SPI | See pin assignment per board above |
| Software GPIO | HX711 | 4, 5 | Bit-banged | Uses `HX711` library; does **not** use SPI peripheral |
| I2C (Wire) | SSD1306 | 21, 22 | I2C | `Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN)` |

#### Pin conflict prevention

- **ESP32-S3 N16R8**: W5500 SPI is isolated from HX711, OLED, matrix,
  built-in RGB LED, and 6932. The only shared-function caveat is JTAG on
  GPIO 39/40; GPIO 38 is reserved for the onboard RGB LED. GPIO 19 is
  intentionally assigned to the validated 6932 DIN wiring.
- **ESP32 / ESP32-DOIT-V1**: W5500 uses GPIO 14/13/12/15/16. HX711 moved to GPIO 4/5 and OLED moved to GPIO 21/22 to avoid SPI/RST conflicts.
- Do **not** move HX711 to GPIO 11/12/13 on ESP32-S3 without also updating W5500 SPI pins.
- Do **not** use GPIO 26–37 on N16R8; these pins belong to flash/PSRAM.
- Do **not** connect the 6932 VDD or LED supply to an ESP32 GPIO.
- Do **not** add an external status LED to GPIO 38; it is reserved for the
  onboard addressable RGB LED.

#### Electrical notes

- HX711 VCC can be 3.3 V or 5 V depending on module variant; check module silkscreen.
- W5500 CS must be pulled low during SPI transactions; the Arduino Ethernet library handles this via `Ethernet.init(W5500_CS_PIN)`.
- W5500 RST is driven actively low for 10 ms during init to guarantee a clean hardware reset.
- OLED reset pin is `-1` (unused) because the SSD1306 is held in reset by default and initialized via I2C address `0x3C`.

> **Note:** `HX711_FAST_PROCESSOR = true` is mandatory for ESP32 because the core can
> toggle GPIO in < 0.4 us; without this flag the library inserts a software delay that
> breaks timing on fast MCUs.
>
> HX711 is bit-banged via the HX711 library and does not use the SPI peripheral, so
> the W5500 hardware-SPI pins are safe from HX711 contention.

---

## 3. Firmware Architecture

### 3.1 Guiding Principles

| Principle | Implementation |
|-----------|---------------|
| **Minimal coupling** | Modules share data only through `SharedState` (mutex-guarded). No direct function calls cross the core boundary. |
| **Deterministic sensor loop** | Scale task runs on core 0 with a fixed 30 ms tick, isolated from all networking latency. |
| **Always-reachable portal** | Soft-AP + DNS never stop regardless of STA status. Configuration is possible even without an upstream router. |
| **Robust persistence** | NVS writes are batched by category and serialised by a recursive mutex (`SettingsStore`); calibration survives power cycles; WiFi creds are separate from calibration data so a factory WiFi reset cannot erase calibration. |
| **Structured logging** | All debug/error paths flow through compile-time `LOG_LEVEL` macros in `Logger.h`, replacing ad-hoc `Serial.print*` calls with level-gated output. |
| **Non-blocking transports** | Ethernet DHCP retry, WiFi reconnect, and transport switches are driven by `millis()`-based state machines with WDT feeding, avoiding blind `delay()` loops. |
| **Bounded allocations** | JSON responses use `snprintf` paths with fixed buffers; SPIFFS-backed offline buffering is capped; deep-sleep hooks are compile-time opt-in. |
| **Zero-placeholder rule** | All code is complete and functional; no TODO stubs shipped in production. |

### 3.2 Module Dependency Graph

```
+-------------------------------------------------------------------+
|                          main.ino                                 |
|  (boot, FreeRTOS task creation, singleton wiring)                 |
+------+----------+-------------+----------------+-----------------+
        |          |             |                |
    config.h   Logger      Settings      (future: RTU...)
    (compile   (level      Store         (mutex IPC)
    constants) gated       (NVS/Prefs)       |
    DeepSleep   output)         |         +---+------------------------+
    OfflineBuffer)     |         |                            |
        |          |         |                            |
    ScaleSensor    |         +---------+  WifiManager       ModbusServer
    Transport.h    |                   (core 1)              (core 1)
    (core 0)       +----------------------------------+
                                                      |
                                                 WebPortal
                                                 (core 1, HTTP + DNS)
```

### 3.3 FreeRTOS Task Layout

The ESP32 WROOM-32 has two Xtensa LX6 cores. Tasks are pinned to avoid WiFi/sensor interference:

```
Core 0 ---------------------------------------------------------------
  Task: "scale"   Priority 2   Stack 4096 B
  |   ScaleSensor::loop()  every 30 ms
  |   HX711 read -> median-of-5 -> adaptive EMA -> stability detector
  |            -> SharedState::setSnapshot()
  +-- Consume commands from SharedState (tare, calibrate, reset...)
  +-- DeepSleep::maybeSleep() when compile-time deep-sleep is enabled

Core 1 ---------------------------------------------------------------
  Task: "net"     Priority 2   Stack 8192 B
  |   WebPortal::handleClient()    HTTP + DNS per iteration
  |   WifiManager::loop()          STA reconnect supervision + OfflineBuffer drain
  +-- ModbusServer::loop()         every 100 ms (MODBUS_POLL_MS)
        +-- reads SharedState::getSnapshot() -> updates Holding Regs

Arduino loop() -------------------------------------------------------
  Calls vTaskDelete(nullptr) immediately.
  All work is inside the two pinned tasks above.
```

**Single-core chips:** Both tasks are pinned to core 0. The scheduler time-slices them. This is acceptable because:
- Scale task runs every 30 ms with minimal work
- Network task is mostly idle (HTTP/DNS/Modbus are event-driven)
- Mutex-protected SharedState prevents data races

**Why two cores?** The HX711 requires precise clock timing (<= 1 us between pulses). Placing the HX711 driver on a core isolated from WiFi interrupt jitter prevents data corruption and missed samples.

On ESP32-S3, true dual-core pinning is used: scale on core 0, network on core 1.

### 3.4 NVS access is serialised across cores

`Preferences`/NVS is **not** reentrant, yet both cores need it:

| Core | Writer | Data |
|------|--------|------|
| 0 (`scale`) | `ScaleSensor` | tare offset, calibration, session totals (every 30 s) |
| 1 (`net`) | `WebPortal` | WiFi configuration, calibration applied from the portal, factory reset |

Two concurrent `Preferences::begin()/end()` pairs on the same namespace corrupted the internal handle — the portal then appeared to hang when applying a configuration or a calibration. `SettingsStore` now guards every operation with a **recursive mutex** created in `SettingsStore::begin()` (called from `setup()` before any task starts):

```
lockNvs()                      // xSemaphoreTakeRecursive(portMAX_DELAY)
  openWrite() / openRead()     // Preferences::begin(PREF_NAMESPACE, false)
  ... read / write keys ...
  close()                      // Preferences::end()
unlockNvs()                    // xSemaphoreGiveRecursive()
```

The mutex is recursive so composite helpers (`saveAll()` → `saveWifi()` + `saveCalibration()` + `saveTotals()`) stay safe, and `saveCalibrationValues()` only touches the three calibration keys so it can never overwrite a fresher tare offset.

---

## 4. Module Reference

### 4.1 `config.h` — Compile-Time Constants

All hardware pin numbers, timing intervals, stack sizes and feature switches are centralised here. No magic numbers appear elsewhere in the codebase.

| Constant | Default | Purpose |
|----------|---------|---------|
| `LOADCELL_DOUT_PIN` | 14 | HX711 data pin |
| `LOADCELL_SCK_PIN` | 15 | HX711 clock pin |
| `HX711_FAST_PROCESSOR` | true | Removes software delay for ESP32 |
| `HX711_READS` | 10 | Samples averaged per raw reading |
| `SCALE_SAMPLE_MS` | 30 | Sensor task period (ms) |
| `SCALE_MEDIAN_WINDOW` | 5 | Samples used to reject isolated spikes |
| `SCALE_FILTER_WINDOW` | 10 | Filtered samples used for stability range |
| `SCALE_SLOW_ALPHA` | 0.10 | EMA coefficient while the load is stable |
| `SCALE_FAST_ALPHA` | 0.60 | EMA coefficient while the load changes |
| `SCALE_CHANGE_THRESHOLD_G` | 200 | Change in grams that selects fast EMA |
| `SCALE_STABILITY_RANGE_G` | 10 | Maximum recent range considered stable |
| `SCALE_STABILITY_HOLD_MS` | 1000 | Required stable duration |
| `AP_SSID_PREFIX` | `"ENYX-SMARTHUB-"` | Soft-AP SSID prefix (+ last 3 bytes of MAC) |
| `AP_SSID_PASSWORD` | `""` | Empty = open AP (recommended for captive portal) |
| `AP_CHANNEL` | 6 | 2.4 GHz channel for the AP |
| `AP_MAX_CONNECTIONS` | 4 | Max concurrent AP clients |
| `MODBUS_PORT` | 502 | Modbus TCP standard port |
| `MODBUS_POLL_MS` | 100 | Register publish interval |
| `WEB_PORT` | 80 | HTTP portal port |
| `CORE_SCALE` | 0 | Sensor task core |
| `CORE_NETWORK` | 1 | Network task core |
| `TASK_STACK_SCALE` | 4096 | Scale task stack (bytes) |
| `TASK_STACK_NETWORK` | 8192 | Network task stack (bytes) |
| `FORCE_AP_PIN` | -1 | GPIO for force-AP button (-1 = disabled) |
| `FORCE_AP_HOLD_MS` | 3000 | Hold duration to trigger force-AP (ms) |
| `PREF_NAMESPACE` | `"scale"` | NVS namespace |
| `FW_VERSION` | `0x0105` | Major.Minor encoded (1.5) |
| `DEEP_SLEEP_ENABLED` | `0` | Compile-time deep-sleep opt-in for battery/solar deployments |

---

### 4.2 `Settings` — NVS Persistence

**Files:** [`Settings.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/Settings.h) / [`Settings.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/Settings.cpp)
**Storage backend:** Arduino `Preferences` library -> ESP32 NVS (non-volatile storage) in flash.

#### AppSettings fields

| Field | Type | NVS key | Description |
|-------|------|---------|-------------|
| `wifiMode` | `uint8_t` | `wifiMode` | 0=none, 1=WPA2-PSK, 2=WPA2-Enterprise |
| `ssid` | `String` | `ssid` | Target SSID |
| `wpaPassword` | `String` | `psk` | WPA2-PSK passphrase |
| `entIdentity` | `String` | `eid` | EAP outer identity |
| `entUsername` | `String` | `eusr` | EAP inner username |
| `entPassword` | `String` | `epwd` | EAP inner password |
| `calOffset` | `float` | `calOff` | Tare offset in raw HX711 counts |
| `countsPerKg` | `float` | `cntPerKg` | Calibration slope (counts/kg) |
| `calIntercept` | `float` | `calInt` | Calibration intercept (counts at 0 kg) |
| `calibrated` | `bool` | `calib` | True = slope and intercept are valid |
| `totalG` | `double` | `totalG` | Accumulated session weight (grams) |
| `sampleCount` | `uint32_t` | `count` | Number of stable samples accumulated |

#### Persistence strategy

- **WiFi creds** saved via `saveWifi()` — separate from calibration so a "reset WiFi" cannot accidentally destroy the calibration.
- **Calibration** saved via `saveCalibration()` — triggered only by explicit tare/calibrate commands.
- **Session totals** auto-flushed every 30 s from the scale task and on explicit `CMD_FLUSH`.
- **Factory reset** (`factoryReset()`) wipes all NVS keys in the namespace.
- **Namespace auto-creation**: `openRead()` uses RW mode (`false`) so the `"scale"` namespace is created automatically on first boot, avoiding the `NOT_FOUND` error during initial `load()`.

---

### 4.2 `Logger` — Compile-Time Logging

**Files:** [`Logger.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/Logger.h) / [`Logger.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/Logger.cpp)

All firmware debug/error output is routed through level-gated macros instead of ad-hoc `Serial.print*` calls. The log level is selected at compile time via `LOG_LEVEL`:

| Macro | Level | Default enabled |
|-------|-------|-----------------|
| `LOG_DEBUG(fmt, ...)` | 4 | No |
| `LOG_INFO(fmt, ...)` | 3 | Yes |
| `LOG_WARN(fmt, ...)` | 2 | Yes |
| `LOG_ERROR(fmt, ...)` | 1 | Yes |

Setting `LOG_LEVEL=LOG_LEVEL_ERROR` strips all lower-severity output at compile time, reducing flash usage and CPU cycles on the network task. `Logger::begin()` initialises the serial port; all macros delegate to `Serial.printf` with a consistent `[domain]` prefix.

---

### 4.3 `TransportState` — Minimal Transport FSM

**Files:** [`Transport.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/Transport.h)

Shared `TransportState` enum used by `WifiManager`, `EthernetManager`, and `ModbusServer`:

| State | Meaning |
|-------|---------|
| `WiFi` | WiFi AP+STA active; Modbus TCP over WiFi |
| `Ethernet` | W5500 Ethernet active; WiFi STA disconnected |
| `Switching` | Transition in progress; deferred apply from `loop()` |

Transport changes are requested via `requestTransportMode(mode)` and applied on the next loop iteration, keeping HTTP handlers and ISR-safe code free of blocking radio calls.

---

### 4.4 `EthernetManager` — W5500 Non-Blocking DHCP

**Files:** [`EthernetManager.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/EthernetManager.h) / [`EthernetManager.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/EthernetManager.cpp)

The old implementation blocked inside `initEthernet()` with `delay(500)` until DHCP succeeded or 3 s elapsed. The new implementation uses an explicit `DhcpState` machine:

| DhcpState | Behaviour |
|-----------|-----------|
| `Idle` | No Ethernet request pending |
| `Attempting` | Calls `Ethernet.begin(mac)` on a `millis()`-based timer with exponential backoff: 500 ms → 1 s → 2 s → 4 s → 8 s |
| `FallbackStatic` | After 6 failed attempts, falls back to the configured static IP |
| `LinkWait` | Waits 1 s for the link to come up before declaring `active` |
| `Complete` | Terminal state; `loop()` reports active |

The WDT is fed on every DHCP attempt and during link wait, so a flaky W5500 link cannot trip the task watchdog. The outer `EthernetManager::loop()` also retains a 5 s retry timer for full re-initialisation if the link drops after becoming active.

---

### 4.5 `WifiManager` — WiFi Exponential Backoff

**Files:** [`WifiManager.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/WifiManager.h) / [`WifiManager.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/WifiManager.cpp)

STA reconnect uses a bounded exponential backoff instead of a fixed 5 s retry:

| Event | Next reconnect delay |
|-------|----------------------|
| First disconnect after connect | 5 s (reset to baseline) |
| 1st retry | 10 s |
| 2nd retry | 30 s |
| 3rd+ retry | 60 s |

State transitions are logged once (`[wifi] state=sta-connected`, `[wifi] state=sta-disconnected`) using instance flags, avoiding log spam in the 5-second polling loop.

---

### 4.6 `OfflineBuffer` — SPIFFS Bounded Queue

**Files:** [`OfflineBuffer.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/OfflineBuffer.h)

A minimal JSON-lines buffer for deferred telemetry when the STA uplink is down:

| Property | Value |
|----------|-------|
| Backing store | SPIFFS `/offline.jsonl` |
| Max entries | 50 |
| Max entry size | 200 bytes |
| Append behaviour | Throttled to one entry every 5 s |
| Drain behaviour | One entry popped per WiFi reconnect cycle |

`WifiManager::loop()` appends a minimal timestamped payload when disconnected and drains the oldest entry once `staConnected()` becomes true. The queue is bounded so a long outage cannot exhaust flash.

---

### 4.7 `DeepSleep` — Optional Battery Mode

**Files:** [`DeepSleep.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/DeepSleep.h)
**Control:** `DEEP_SLEEP_ENABLED` in `config.h` (default `0`)

When enabled, the scale task calls `DeepSleep::maybeSleep()` after each acquisition cycle. Hook points are provided for timer-based or HX711-data-ready wake-up. Default-disabled preserves existing always-on behaviour for wired deployments.

---

### 4.8 `WebPortal` — Bounded JSON Responses

**Files:** [`WebPortal.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/WebPortal.h) / [`WebPortal.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/transmitter-multi-core/src/WebPortal.cpp)

High-traffic GET endpoints use `sendJsonBounded()` with a 512-byte stack buffer to avoid unbounded `String` concatenation. Calibration success responses also use bounded formatting.

---

### 4.9 `SharedState` — Inter-Core IPC

**Files:** [`SharedState.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/SharedState.h) / [`SharedState.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/SharedState.cpp)
**Mechanism:** Single FreeRTOS `SemaphoreHandle_t` mutex protecting a value-copy struct (`ScaleSnapshot`) and a one-deep command slot.

#### ScaleSnapshot (written by sensor core, read by network core)

| Field | Unit | Description |
|-------|------|-------------|
| `rawSample` | counts | HX711 reading with tare offset subtracted |
| `weightG` | grams | Instantaneous calibrated weight |
| `medianWeightG` | grams | Median-filtered weight with isolated spikes removed |
| `stableWeightG` | grams | Adaptively EMA-filtered weight |
| `noiseG` | grams | Range of recent filtered samples |
| `stable` | bool | True after the stability range is held for one second |
| `stableSampleCount` | samples | Samples accumulated while stable |
| `offsetCounts` | counts | Current tare offset |
| `countsPerKg` | counts/kg | Calibration slope |
| `calibrated` | bool | Slope is valid |

#### Command slot (written by network core, consumed by sensor core)

| Command enum | Value | Argument |
|-------------|-------|---------|
| `CMD_NONE` | 0 | — |
| `CMD_TARE` | 1 | — |
| `CMD_CALIBRATE` | 2 | Known weight in kg (float) |
| `CMD_CALIBRATE_MLR` | 5 | `countsPerKg` (float) + intercept (float) |
| `CMD_RESET_SESSION` | 3 | — |
| `CMD_FLUSH` | 4 | — |
| `CMD_WIPE_WIFI` | 99 | — (triggers reboot) |

The command slot is a single-producer / single-consumer queue of depth 1. The sensor task calls `takeCommand()` at the start of every loop; only one pending command can exist at a time, which is sufficient because portal interactions are human-paced.

---

### 4.4 `ScaleSensor` — Load Cell Acquisition

**Files:** [`Scale.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/Scale.h) / [`Scale.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/Scale.cpp)
**Runs on:** Core 0 ("scale" task)

#### Acquisition pipeline

```
HX711 (24-bit ADC, GPIO 14/15)
       |
       v  get_value()            <- blocks <= 40 ms (hxPoll)
  raw counts (offset subtracted by HX711 library)
       |
       v  / countsPerKg * 1000
  instantaneous weight (grams)
       |
       v  median-of-5: medianWeightG
       |
       v  adaptive EMA: slow alpha at rest, fast alpha on load changes
  stableWeightG (grams)
       |
       v  recent range <= stability threshold for one second
  stable flag
       +-- stable and > 5 g  ->  accumulate session totals
       |
       +-- SharedState::setSnapshot()  (mutex-guarded)
```

#### Filtering and stability

`HX711_READS` first averages samples inside the HX711 library. A median of
five calibrated samples then rejects isolated spikes. The adaptive EMA uses
`SCALE_SLOW_ALPHA` for quiet readings and `SCALE_FAST_ALPHA` when the median
changes by at least `SCALE_CHANGE_THRESHOLD_G`, preserving responsiveness when
a load is placed or removed. The last `SCALE_FILTER_WINDOW` filtered samples
are measured as a range. The `stable` flag is asserted only after that range
remains within `SCALE_STABILITY_RANGE_G` for `SCALE_STABILITY_HOLD_MS`.

Display, Modbus stable-weight output, and session totals use
`stableWeightG`. Raw and intermediate values remain available for diagnosis.

| alpha | Effect |
|-------|--------|
| 0.10 | Very smooth, slow response (~10 samples = 300 ms) |
| 0.35 | **Default** — balanced for packaging-line use |
| 0.70 | Fast response, noisier output |

#### Two-point / Multi-Point calibration procedure

1. **Tare** — Empty platform. Send `CMD_TARE`. HX711 library sets internal offset to current raw average. Offset persisted to NVS (calibration is invalidated until it is applied again).
2. **Single-point calibrate** — Place known reference mass (kg) and call `POST /api/calibrate?kg=<mass>`. The portal computes `countsPerKg = rawCounts / knownKg` from the live snapshot, persists it with `SettingsStore::saveCalibrationValues()` and schedules a restart (~1.2 s).
3. **Multi-point calibrate** — Capture 1–10 raw readings at different known masses via the web UI. The browser computes the average ratio `countsPerKg = mean(rawCounts / weightKg)` and calls `POST /api/calibrate/multi?slope=<countsPerKg>`. The portal persists the value (`calIntercept` is forced to `0`) and schedules a restart.
4. **Restart** — Applying a calibration always restarts the ESP32. The coefficients are written to NVS *before* the reset, so the transmitter boots with the new calibration loaded, exactly like after a power cycle. The web UI shows a "Transmitter restarting" overlay, polls `/api/status` until the device answers again and then reloads the page.

---

### 4.5 `WifiManager` — WiFi + Ethernet Transport

**Files:** [`WifiManager.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/WifiManager.h) / [`WifiManager.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/WifiManager.cpp)
**Runs on:** Core 1, polled via `loop()`

The ESP32 WiFi stack supports simultaneous **AP + STA** mode (`WIFI_AP_STA`). Both interfaces are always active; the AP for configuration, the STA for upstream connectivity.

#### Transport modes

| Mode | Value | Behavior |
|------|-------|----------|
| `TRANSPORT_WIFI` | 0 | Soft-AP + STA uplink, Modbus TCP over WiFi + Ethernet |
| `TRANSPORT_ETHERNET` | 1 | Soft-AP only, Modbus TCP over Ethernet only |

> **Note:** `transportMode` now only controls WiFi STA behavior. W5500 Ethernet is always initialized regardless of mode. Modbus TCP is served on **both WiFi and Ethernet simultaneously** in `TRANSPORT_WIFI` mode. In `TRANSPORT_ETHERNET` mode, WiFi STA is disconnected and Modbus TCP is served over Ethernet only. The captive portal remains WiFi Soft-AP only (`192.168.4.1`).

#### Boot sequence

```
begin(AppSettings)
  |
  +-> WiFi.disconnect(false) + WiFi.setSleep(false)
  +-> WiFi.mode(WIFI_AP) + softAP() with retry + AP IP wait loop
  +-> WiFi.mode(WIFI_AP_STA)
  |
  +-> if transportMode == Ethernet:
  |     beginEthernet() -> SPI.begin() + Ethernet.init() + Ethernet.begin()
  |     WiFi.disconnect(false)
  +-> else:
  |     stopEthernet()
  |     startSta(AppSettings)
```

#### Reconnection loop (`loop()`)

Called every network task iteration. Checks STA state every 5 s; if disconnected and a saved SSID exists, re-initiates connection without restarting the AP or portal. When Ethernet transport is active and the link is down, attempts to reinitialize W5500.

STA reconnect uses exponential backoff: 5 s → 10 s → 30 s → 60 s. `OfflineBuffer` appends a minimal timestamped JSON line when disconnected and drains one entry per reconnect cycle when STA comes back.

#### Deferred configuration apply (why `POST /api/wifi` answers immediately)

| Step | Where | What happens |
|------|-------|--------------|
| 1 | `WebPortal::handleApiWifi()` (network task) | Validates the form, writes NVS, sends the JSON response |
| 2 | `WebPortal::handleApiWifi()` | Calls `WifiManager::requestSettings()` — **no radio calls**, just stores the pending config |
| 3 | `WifiManager::loop()` after `WIFI_APPLY_DELAY_MS` (750 ms) | `startSta()` disconnects/joins the uplink and supervises it from then on |

The delay is what makes "Apply Configuration" feel instant: the browser receives its response while the AP/uplink is still untouched, and the radio is only reconfigured afterwards. The soft-AP is never stopped, so the portal stays reachable even if the new credentials are wrong.

`wifiMode = 0` now actively drops a previously configured uplink (`WiFi.setAutoReconnect(false)` + `WiFi.disconnect(false)`), so switching back to "soft-AP only" really disconnects the station.

#### Key design decisions

- **AP never stops:** Even if STA credentials are wrong, the portal remains accessible on `192.168.4.1`.
- **Non-blocking connect:** `WiFi.begin()` is non-blocking; `loop()` polls `WiFi.status()` and retries on `WL_DISCONNECTED` / `WL_CONNECTION_LOST`.
- **No radio work inside HTTP handlers:** WiFi reconfiguration is queued and executed by the network task loop, so the web server never stalls mid-response.
- **WPA2-Enterprise:** Uses `esp_wifi_sta_wpa2_ent_*` API for PEAP/MSCHAPv2. When the outer identity is left empty the inner username is used instead, and a missing inner username is rejected by the portal with a validation error.
- **Transport FSM:** `TransportState::WiFi/Ethernet/Switching` replaces scattered boolean flags. `requestTransportMode()` defers the actual switch to `loop()`, keeping HTTP handlers and radio transitions deterministic.
- **Exponential backoff:** WiFi reconnect delay grows 5 s → 10 s → 30 s → 60 s to avoid storming the AP during prolonged outages.

---

### 4.6 `ModbusServer` — Dual-Transport Modbus TCP Register Map

**Files:** [`ModbusServer.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/ModbusServer.h) / [`ModbusServer.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/ModbusServer.cpp)
**WiFi library:** `emelianov/modbus-esp8266 @ 4.1.0`
**Ethernet library:** Arduino `Ethernet` library (vendored)
**Runs on:** Core 1, polled every `MODBUS_POLL_MS` = 100 ms
**Port:** 502 (TCP)

The device acts as a **Modbus TCP server** (formerly "slave"). Holding registers (FC 03/06/16) are used. All multi-word values are **big-endian, high word first** (IEEE 754 float split into two 16-bit registers).

Supports **dual-transport** simultaneously:
- **WiFi**: `ModbusTCP` server from modbus-esp8266
- **Ethernet**: Manual MBAP parser over `EthernetServer`/`EthernetClient` from Arduino Ethernet library

Both transports share the same holding register bank. The WiFi path uses the modbus-esp8266 library (`_mb.task()`); the Ethernet path uses a custom parser (`processEthernetModbus()`) that decodes MBAP frames manually and reads/writes registers via `_mb.Hreg()`.

#### Holding Register Map

Base address: **40001** (Modbus convention). Internal offset = Modbus address - 40001.

| Modbus Addr | Offset | Words | Type | R/W | Description |
|-------------|--------|-------|------|-----|-------------|
| 40001-40002 | 0-1 | 2 | FLOAT32 | R | Instantaneous weight (grams) |
| 40003-40004 | 2-3 | 2 | FLOAT32 | R | Stable (EMA-filtered) weight (grams) |
| 40005-40006 | 4-5 | 2 | FLOAT32 | R | Raw HX711 counts (offset subtracted) |
| 40007-40008 | 6-7 | 2 | FLOAT32 | R | Tare offset (counts) |
| 40009-40010 | 8-9 | 2 | FLOAT32 | R | Calibration slope (counts/kg) |
| 40030-40031 | 29-30 | 2 | FLOAT32 | R | Calibration intercept (counts) |
| 40011 | 10 | 1 | UINT16 | R | Status flags (see below) |
| 40012 | 11 | 1 | INT16 | R | RSSI dBm (0 if STA not connected) |
| 40013 | 12 | 1 | UINT16 | R | WiFi mode (0=none, 1=PSK, 2=ENT) |
| 40014 | 13 | 1 | UINT16 | R | Firmware version (hi byte=major, lo=minor) |
| 40015 | 14 | 1 | UINT16 | R | Uptime seconds (wraps at 65535) |
| 40016 | 15 | 1 | UINT16 | R/W | Command register |
| 40017-40018 | 16-17 | 2 | FLOAT32 | R/W | Command argument (e.g. calibration kg) |
| 40019 | 18 | 1 | UINT16 | R | Session sample count high word |
| 40020 | 19 | 1 | UINT16 | R | Session sample count low word |
| 40021-40022 | 20-21 | 2 | FLOAT32 | R | Session total weight (grams) |
| 40023-40024 | 22-23 | 2 | FLOAT32 | R | Session minimum weight (grams) |
| 40025-40026 | 24-25 | 2 | FLOAT32 | R | Session maximum weight (grams) |
| 40027 | 26 | 1 | UINT16 | R | Client connected (0/1) |
| 40028 | 27 | 1 | UINT16 | R | Reserved (0) |
| 40029 | 28 | 1 | UINT16 | R | Reserved (0) |

**Total allocated:** 31 holding registers (offsets 0..30).

#### Status flags — register 40011 (offset 10)

| Bit | Mask | Meaning |
|-----|------|---------|
| 0 | `0x0001` | HX711 hardware ready |
| 1 | `0x0002` | Scale calibrated (countsPerKg valid) |
| 2 | `0x0004` | STA WiFi connected |
| 3 | `0x0008` | Command pending (not yet consumed) |
| 4 | `0x0010` | Weight is stable |

#### Modbus command codes (write to register 40016)

| Value | Command | Argument reg (40017-40018) |
|-------|---------|---------------------------|
| 1 | Tare | — |
| 2 | Calibrate | Known weight in kg (FLOAT32) |
| 3 | Reset session totals | — |
| 4 | Flush totals to NVS | — |
| 99 | Wipe WiFi + reboot | — |

#### Float encoding — two-register IEEE 754

```
Weight 1234.56 g -> IEEE 754: 0x449A8F5C
  Register N   (high word) = 0x449A
  Register N+1 (low word)  = 0x8F5C

Python decode:
  import struct
  raw = (high_word << 16) | low_word
  value = struct.unpack('>f', struct.pack('>I', raw))[0]
```

---

### 4.7 `WebPortal` — Captive Portal & Configuration UI

**Files:** [`WebPortal.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/WebPortal.h) / [`WebPortal.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/WebPortal.cpp)
**HTTP server:** ESP32 Arduino `WebServer` on port 80
**DNS:** `DNSServer` wildcard redirect -> captive portal IP

#### Always-on access points

| Network | IP | How to reach |
|---------|-----|-------------|
| Soft-AP | `192.168.4.1` | Connect to `ENYX-SMARTHUB-AABBCCDDEEFF` (open network) |
| LAN uplink | DHCP-assigned | Browse to device IP when STA is connected |

When a device connects to the Soft-AP and opens any URL, DNS returns `192.168.4.1` for all queries, triggering the OS captive-portal detection flow on iOS, Android, macOS, and Windows.

#### HTTP REST API

| Method | Path | Query / Body params | Description |
|--------|------|---------------------|-------------|
| `GET` | `/` | — | Single-page UI (`/index.html` served from SPIFFS) |
| `GET` | `/css/style.css` | — | Stylesheet served from SPIFFS |
| `GET` | `/js/app.js` | — | Client application script served from SPIFFS |
| `GET` | `/api/status` | — | JSON snapshot: weight, calibration, WiFi, transport, display, uptime, session |
| `GET` | `/api/config` | — | Return stored WiFi + transport + display config as JSON |
| `POST` | `/api/wifi` | Form: `mode`, `ssid`, `psk`, `eid`, `eusr`, `epwd` | Validate + save WiFi credentials, answer, then apply the uplink asynchronously |
| `POST` | `/api/tare` | — | Issue `CMD_TARE` |
| `POST` | `/api/calibrate` | Query: `kg=<float>` | Persist single-point `countsPerKg` to NVS + schedule restart |
| `POST` | `/api/calibrate/multi` | Query: `slope=<float>` | Persist averaged `countsPerKg` to NVS + schedule restart |
| `POST` | `/api/totals/reset` | — | Issue `CMD_RESET_SESSION` |
| `POST` | `/api/portal/force` | — | Forget uplink credentials + restart into soft-AP setup mode |
| `POST` | `/api/factory` | — | Wipe all NVS + restart |
| `GET` | `/api/transport` | — | Return current transport mode + status |
| `POST` | `/api/transport` | Form: `mode` (0=WiFi, 1=Ethernet) | Switch transport mode |
| `GET` | `/api/ethernet/config` | — | Return W5500 config (DHCP/static IP) |
| `POST` | `/api/ethernet/config` | Form: `useDhcp`, `staticIp`, `staticGateway`, `staticSubnet`, `staticDns` | Save W5500 config + apply transport |
| `GET` | `/api/display/config` | — | Return OLED enabled state |
| `POST` | `/api/display/config` | Form: `enabled` (true/false) | Enable/disable OLED |
| `GET` | `/*` | — | Captive redirect -> `/` (Android/iOS/Windows probes + unknown hosts) |

#### Response formats

Mutation endpoints return the project-wide wrapper **plus** the legacy `ok` flag used by the bundled web UI:

```json
{ "ok": true, "success": true, "message": "English status text" }
```

Errors carry a machine-readable code and an English message:

```json
{
  "ok": false,
  "success": false,
  "error": { "code": "SSID_REQUIRED", "message": "A network SSID is required when an uplink mode is selected" },
  "message": "Network SSID is required"
}
```

| Error code | HTTP | Raised when |
|------------|------|-------------|
| `INVALID_WIFI_MODE` | 400 | `mode` is not 0/1/2 |
| `SSID_REQUIRED` | 400 | Uplink selected without an SSID |
| `PSK_TOO_SHORT` | 400 | WPA2-PSK password shorter than 8 characters |
| `ENTERPRISE_USERNAME_REQUIRED` | 400 | Enterprise mode without an inner username |
| `INVALID_REFERENCE_WEIGHT` | 400 | `/api/calibrate` without a positive kg value |
| `SENSOR_NOT_READY` | 409 | `/api/calibrate` before the HX711 produced a reading |
| `INVALID_CALIBRATION` | 400 | `/api/calibrate` computed a non-positive counts/kg |
| `INVALID_CALIBRATION_SLOPE` | 400 | `/api/calibrate/multi` without a positive slope |

`/api/status` returns a flat JSON object with live telemetry:

```json
{
  "weightKg": 1.234,
  "stableG": 1234.0,
  "noiseG": 2.5,
  "stable": true,
  "raw": 56789.0,
  "offset": 12345.0,
  "countsPerKg": 45678.0,
  "intercept": 0.0,
  "calibrated": true,
  "sensorReady": true,
  "rebooting": false,
  "totalG": 5432.0,
  "sampleCount": 42,
  "minG": 100.0,
  "maxG": 2345.0,
  "modbusClients": 1,
  "uptime": 3600,
  "fw": "1.4",
  "wifi": {
    "modeName": "WPA2-PSK",
    "mode": 1,
    "ssid": "MyNet",
    "status": "connected",
    "rssi": -45,
    "staIp": "192.168.1.100",
    "apSsid": "ENYX-SMARTHUB-AABBCCDDEEFF",
    "apIp": "192.168.4.1"
  },
  "transport": {
    "mode": 0,
    "modeName": "WiFi",
    "ethernetActive": false,
    "ethernetIp": "",
    "w5500UseDhcp": true,
    "w5500StaticIp": "192.168.1.100",
    "w5500StaticGateway": "192.168.1.1",
    "w5500StaticSubnet": "255.255.255.0",
    "w5500StaticDns": "8.8.8.8"
  },
  "display": {
    "oledEnabled": true
  }
}
```

Unknown `/api/*` paths return:

```json
{
  "ok": false,
  "success": false,
  "error": { "code": "API_NOT_FOUND", "message": "API endpoint not found" },
  "message": "API endpoint not found"
}
```

#### WiFi configuration flow

```
User opens portal
  -> GET /api/status  (UI shows current mode and STA status)
  -> GET /api/config  (UI pre-fills SSID / PSK / enterprise fields)
  -> User selects mode + fills fields, presses "Apply Configuration"
  -> POST /api/wifi  (form-encoded: mode, ssid, psk, eid, eusr, epwd)
       -> validation (400 + error.code on failure)
       -> Settings saved to NVS via saveWifi()          [mutex-protected]
       -> HTTP 200 answered to the browser
       -> WifiManager::requestSettings() marks the config as pending
  -> 750 ms later (network task loop): WifiManager::startSta()
       -> uplink disconnect/join, AP stays up
  -> UI polls GET /api/status to see the STA connection result
```

#### Calibration apply & restart flow

```
User captures reference points, presses "Apply Calibration"
  -> POST /api/calibrate/multi?slope=<countsPerKg>
       -> validation (400 + error.code on failure)
       -> SettingsStore::saveCalibrationValues() writes NVS   [mutex-protected]
       -> CMD_CALIBRATE_MLR queued so the live snapshot updates too
       -> HTTP 200 answered ("... Device is rebooting...")
       -> scheduleReboot(1200 ms)
  -> WebPortal::processPendingReboot() waits until no command is pending
  -> ESP.restart()
  -> browser shows the reboot overlay, polls /api/status until the device
     answers again, then reloads the page (calibration is now live)
```

---

## 5. Boot Sequence

```
setup()
  |
  +- Serial.begin(115200)
  +- gSettings.begin()                   <- create the cross-core NVS mutex
  +- gSettings.load(gAppSettings)        <- restore NVS settings
  +- checkForceApButton()                <- hold FORCE_AP_PIN to wipe WiFi creds
  +- gShared.begin()                     <- create mutex, zero state
  +- gScale.begin()                      <- HX711 power up, restore calibration
  +- gWifi.begin()                       <- start AP + STA (if configured)
  +- gModbus.begin() + startServer() + startEthernetServer()  <- register holding regs, listen :502 on WiFi and Ethernet
  +- gPortal.begin() + startDns()        <- bind HTTP :80, DNS wildcard
  |
  +- xTaskCreatePinnedToCore(networkTask, "net",   8192, core=1)
  +- xTaskCreatePinnedToCore(scaleTask,   "scale", 4096, core=0)
  |
  +- vTaskDelete(nullptr)                <- Arduino loop task exits immediately
```

---

## 6. Data Flow

```
          +-------------- Core 0 ---------------+
          |                                      |
           |  HX711 (GPIO 14, 15)                |
          |    | 24-bit reading every 30 ms       |
          |    v                                  |
          |  ScaleSensor::loop()                  |
          |    +- EMA filter -> stableWeightG     |
          |    +- accumulate session totals        |
          |    +- SharedState::setSnapshot()  <---+---(mutex)
          |                                      |
          +--------------------------------------+
                           |
                    mutex-guarded copy
                           |
          +-------------- Core 1 ---------------+
          |                                      |
          |  SharedState::getSnapshot()           |
          |    |                                  |
          |    +-> ModbusServer::publish()        |
          |    |     Holding Regs -> TCP clients  |
          |    |     (FC03 read, every 100 ms)    |
          |    |                                  |
          |    +-> WebPortal::handleApiStatus()   |
          |          JSON -> HTTP clients         |
          |                                      |
          |  Portal/Modbus write command          |
          |    +-> SharedState::requestCommand()  |
          |         (consumed next scale loop)    |
          +--------------------------------------+
```

---

## 7. WiFi Dual-Mode Design

```
                      +-------------------------------+
                      |   ESP32 WiFi Stack            |
                      |   mode: WIFI_AP_STA           |
                      |                               |
               +------+ Soft-AP (ALWAYS ON)           |
                |      |  SSID: ENYX-SMARTHUB-AABBCCDDEEFF    |
               |      |  IP:   192.168.4.1            |
               |      |  Open network                 |
               |      +-------------------------------+
               |
   Phone /     |   Configuration (WiFi-only)
   Laptop      |   GET/POST /api/*
               |   Captive portal auto-triggered
               |
               |      +-------------------------------+
               +------+ STA uplink (when configured)  |
                      |  WPA2-PSK or WPA2-Enterprise  |
                      |  DHCP IP from router          |
                      +---------------+---------------+
                                      |
                               LAN / industrial network
                                      |
                            Modbus TCP master
                            (SCADA, PLC, Node-RED,
                             E-Tani Smart Hub)

   Ethernet (W5500) runs in parallel for Modbus TCP only:
         +-------------------------------+
         |   W5500 Ethernet              |
         |   Modbus TCP server :502      |
         +-------------------------------+
```

Both interfaces run concurrently. The AP is **never disabled** — if STA credentials are wrong or the upstream router is offline, the operator can always connect to the AP, access the portal, and reconfigure without a hardware reset.

---

## 8. Local keypad and 6932 display

The GN/TA/AiP6932 7-segment path is the default for the ESP32-S3
environment (`DISPLAY_USE_6932=1`). In that mode the OLED is not initialized
or refreshed. The
4x5 matrix is enabled automatically and is scanned from `networkTask`, where
UI state and display writes remain on one core.

The keypad layout is:

```
C    ADD  TARE ZERO M4
9    6    3   STORE M3
8    5    2   .    M2
7    4    1   0    M1
```

`TARE` sends `CMD_TARE` to the scale task. `C` clears the current unit-price
entry. `ADD` calculates `weightKg * unitPrice` using integer cents and adds it
to the accumulated total. `STORE` persists the total price and requests the
existing session flush command. `ZERO` clears both the current price entry and
the accumulated price total, and persists that reset. `M1`–`M4` recall the
four price presets stored by the portal/NVS.

The display uses fixed-point values to avoid floating-point currency drift:
unit prices are stored in cents and the accumulated total is stored in
unsigned 64-bit cents. The section format is:

| Section | Grids | Value | Decimal-point grid |
|---------|-------|-------|--------------------|
| 1 | 0–4 | Weight in kg, two decimals | Grid 2 |
| 2 | 5–9 | Unit price, two decimals | Grid 7 |
| 3 | 10–15 | Accumulated price, two decimals | Grid 13 |

Leading positions are blank. For example, centi-value `123` is rendered as
`001.23` in a five-grid section. Decimal-point positions are explicit rather
than enabling DP on every grid, which keeps numeric output readable.

### 8.2 Serial Monitor test commands

With the default `esp32s3` firmware running at 115200 baud, send one command
per line. `CRLF` or `LF` line endings are accepted.

| Command | Example | Function |
|---------|---------|----------|
| `test display` | `test display` | Runs a single quick loop: `8` on section 1, then 2, then 3 (~800 ms each), then automatically returns to live display |
| `test keypad` | `test keypad` | Toggles keypad test mode; every press/release is printed with its button id and label, normal keypad actions are suspended while active |
| `exit` | `exit` | Leaves any active test mode immediately (display test and/or keypad test) and resumes normal operation |

`test display` lights all grids of section 1 (`88888`), then section 2
(`88888`), then section 3 (`888888`), holding each section for roughly 800 ms
with a brief clear frame in between. The sequence runs in the background
(non-blocking, `millis()`-driven) while Modbus polling, the web portal, and the
periodic state log keep running. After the last section the firmware clears the
test overlay automatically and the live weight/price display resumes on its
next 500 ms refresh tick, so no manual resume command is needed.

While keypad test mode is active, every press and release is reported as
`KEYPAD TEST: pressed id=<id> [<label>]` or `KEYPAD TEST: released id=<id>
[<label>]`, and the normal keypad actions (price entry, TARE, ADD, preset
recall, STORE, ZERO) are suspended so testing cannot change live pricing data.
The mode can be left by sending `test keypad` again (toggle) or `exit`.

Keypad test output uses the verified button id mapping:

| Id | Label | Id | Label |
|----|-------|----|-------|
| 0 | C | 10 | 8 |
| 1 | ADD | 11 | 5 |
| 2 | TARE | 12 | 2 |
| 3 | ZERO | 13 | DP |
| 4 | M4 | 14 | M2 |
| 5 | 9 | 15 | 7 |
| 6 | 6 | 16 | 4 |
| 7 | 3 | 17 | 1 |
| 8 | STORE | 18 | 0 |
| 9 | M3 | 19 | M1 |

`exit` while no test is active prints `No active test to exit`. On builds
without the keypad (for example `esp32dev`), `test keypad` reports that the
keypad is not available in this build.

### 8.1 Compile-time feature rules

```cpp
#define DISPLAY_USE_6932 1
```

This is the default configuration. `KEYPAD_ENABLED` becomes `1` automatically
for the ESP32-S3 build. The ESP32dev build retains the OLED path and does not
compile the S3-only matrix/display integration.

## 9. NVS Layout

All keys live in the `"scale"` namespace.

| Key | Type | Category | Description |
|-----|------|---------|-------------|
| `wifiMode` | UChar | WiFi | WiFi mode (0/1/2) |
| `ssid` | String | WiFi | SSID |
| `psk` | String | WiFi | WPA2-PSK password |
| `eid` | String | WiFi | EAP outer identity |
| `eusr` | String | WiFi | EAP inner username |
| `epwd` | String | WiFi | EAP inner password |
| `calOff` | Float | Calibration | Tare offset (counts) |
| `cntPerKg` | Float | Calibration | Counts per kg |
| `calInt` | Float | Calibration | Calibration intercept (counts at 0 kg) |
| `calib` | Bool | Calibration | Calibrated flag |
| `totalG` | Float | Session | Total accumulated grams |
| `count` | UInt | Session | Sample count |
| `transportMode` | UChar | Transport | 0=WiFi, 1=Ethernet |
| `oledEnabled` | Bool | Display | Legacy OLED on/off when using ESP32dev |
| `price1` | Float | Keypad | Unit-price preset 1 |
| `price2` | Float | Keypad | Unit-price preset 2 |
| `price3` | Float | Keypad | Unit-price preset 3 |
| `price4` | Float | Keypad | Unit-price preset 4 |
| `totalPriceCenti` | ULong64 | Keypad | Accumulated price in cents |
| `w5500Dhcp` | Bool | Ethernet | DHCP enabled |
| `w5500Ip` | String | Ethernet | Static IP |
| `w5500Gw` | String | Ethernet | Static gateway |
| `w5500Sn` | String | Ethernet | Static subnet mask |
| `w5500Dns` | String | Ethernet | Static DNS server |

**Access rule:** every read/write goes through `SettingsStore`, which serialises the namespace with a recursive mutex (see §3.4). The `Preferences` handle is opened and closed inside each call, so no stale handle can survive across cores.

**Calibration restart:** applying a calibration from the web portal writes `cntPerKg`, `calInt` and `calib` (`saveCalibrationValues()`) and then restarts the device, so the new values are always loaded by `ScaleSensor::begin()`.

**Factory reset** clears all keys in the namespace and then restarts the device.

---

## 10. Security Considerations

| Area | Current posture | Recommendation for production |
|------|----------------|-------------------------------|
| AP authentication | Open (no WPA) | Intentional for captive portal. Set `AP_SSID_PASSWORD` for secure sites. |
| Portal auth | None (IP-based trust) | Add HTTP Basic Auth or a session token. |
| Modbus TCP | No authentication (standard protocol) | Isolate on VLAN; use firewall/ACL rules. |
| NVS encryption | Off | Enable Flash Encryption + NVS Encryption via ESP-IDF menuconfig. |
| OTA updates | Not implemented | Add ArduinoOTA or ESP32 HTTP OTA for field updates. |

---

## 11. Extension Roadmap (Multi-Protocol)

The architecture allows additional protocol modules to be added to core 1 without modifying `ScaleSensor` or `SharedState`:

```
Planned protocols (plug in on core 1):

  +- Modbus RTU    -> RS-485 transceiver on GPIO, ModbusRTU::begin(Serial2)
  +- HTTP push     -> HTTP POST to E-Tani Smart Hub API
  +- BLE (future)  -> GATT characteristic = stableWeightG (float)
```

To add a new protocol:
1. Create `ProtocolXxx.h/.cpp` with `begin()` and `loop()`.
2. Instantiate a global singleton in `main.ino`.
3. Wire `gShared` pointer in `setup()`.
4. Call `gProtoXxx.loop()` from `networkTask()`.
No other files need modification.

---

## 12. Build & Flash

### Prerequisites

```bash
pip install platformio
```

### Build (ESP32-WROOM-32)

```bash
cd "firmware/transmitter-multi-core"
pio run
```

### Build (ESP32-S3 / ESP32 v4)

```bash
cd "firmware/transmitter-multi-core"
pio run -e esp32s3
```

The default `esp32s3` environment uses the local keypad and GN/TA/AiP6932
7-segment display. The equivalent explicitly named environment is also
available:

```bash
pio run -e esp32s3-6932
```

### Build (ESP32-C3-MINI)

```bash
cd "firmware/transmitter-multi-core"
pio run -e esp32-c3-mini
```

### Flash & Monitor

```bash
pio run -t upload && pio device monitor --baud 115200
```

### Flash SPIFFS Filesystem

```bash
pio run -t uploadfs
```

### Library dependencies (pinned in `platformio.ini`)

| Library | Source | Purpose |
|---------|--------|---------|
| `robtillaart/HX711` | GitHub | Non-blocking HX711 driver (fast processor mode) |
| `emelianov/modbus-esp8266 @ 4.1.0` | GitHub tag | Modbus TCP server (`addHreg`/`Hreg` API) |
| `Preferences` | ESP32 Arduino SDK | NVS persistence (built-in) |
| `WebServer` | ESP32 Arduino SDK | HTTP server (built-in) |
| `DNSServer` | ESP32 Arduino SDK | Captive portal DNS (built-in) |
| `WiFi` | ESP32 Arduino SDK | AP+STA WiFi (built-in) |
| `Adafruit SSD1306` | Adafruit | OLED display driver |
| `Adafruit GFX` | Adafruit | Graphics primitives for OLED |
| `Ethernet` | Arduino official library | W5500 Ethernet driver, vendored in `lib/Ethernet` |

---

## 13. File Structure

```
firmware/transmitter-multi-core/
+-- platformio.ini              <- build config, SPIFFS filesystem, lib dependencies
+-- firmware.md                 <- this document
+-- data/                       <- SPIFFS filesystem assets (HTML/CSS/JS separated)
|   +-- index.html              <- modern responsive captive portal & dashboard UI
|   +-- css/
|   |   +-- style.css           <- portal stylesheet (incl. reboot overlay)
|   +-- js/
|       +-- app.js              <- telemetry polling, REST interaction, reboot-aware flows
+-- src/
    +-- main.ino                <- boot, task creation, singleton wiring
    +-- config.h                <- ALL compile-time constants
    +-- Logger.h/.cpp           <- compile-time log-level macros (DEBUG/INFO/WARN/ERROR)
    +-- Transport.h             <- shared TransportState FSM enum
    +-- DeepSleep.h             <- optional deep-sleep hooks (compile-time opt-in)
    +-- OfflineBuffer.h         <- SPIFFS bounded JSON-lines queue (50 entries / 200 B)
    +-- SharedState.h/.cpp      <- mutex-guarded inter-core data bus + command slot
    +-- Settings.h/.cpp         <- NVS persistence (AppSettings struct) + cross-core mutex
    +-- Scale.h/.cpp            <- HX711 acquisition, EMA filter, calibration
    +-- WifiManager.h/.cpp      <- AP+STA dual-mode WiFi, exponential backoff, OfflineBuffer
    +-- EthernetManager.h/.cpp  <- W5500 non-blocking DHCP with millis backoff + WDT feed
    +-- ModbusServer.h/.cpp     <- Modbus TCP server (WiFi/Ethernet), holding register publish
    +-- WebPortal.h/.cpp        <- HTTP captive portal, bounded JSON responses, deferred reboot
    +-- Display.h/.cpp          <- SSD1306 OLED driver (I2C)
    +-- GN6932.h/.cpp           <- GN/TA/AiP6932 low-level driver
    +-- Gn6932Display.h/.cpp   <- fixed-point three-section renderer
    +-- MatrixScanner.h/.cpp   <- debounced 4x5 matrix scanner
    +-- ButtonManager.h/.cpp   <- keypad actions and price state
```

---