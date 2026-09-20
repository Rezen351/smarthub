# Weight Transmitter — Firmware Design Document

> **E-Tani Smart Hub · Firmware v1.1**
> Target: ESP32-WROOM-32 (dual-core Xtensa LX6, 240 MHz, 520 KB SRAM, 4 MB Flash)
> Also compatible with: ESP32-S3 (Xtensa LX7, 240 MHz, native USB, same GPIO map)
> Also compatible with: ESP32-C3-MINI (single-core RISC-V, WiFi only, compact form factor)
> Build system: PlatformIO · framework-arduinoespressif32 6.6.0 · RTOS: FreeRTOS 10.4

---

## 1. Overview

The **Weight Transmitter** is an autonomous edge device that:

1. Acquires mass data from a strain-gauge load cell via an **HX711** 24-bit ADC.
2. Publishes real-time weight over **Modbus TCP** (acting as a Modbus server on port 502).
3. Provides a **captive-portal web UI** for device configuration and calibration — always reachable regardless of upstream network state.
4. Runs in **dual WiFi mode** simultaneously: Soft-AP (configuration hotspot) + STA uplink (user network), both always-on.

The design is intentionally **protocol-agnostic at the top level**: the `SharedState` bus decouples sensor acquisition from transport, allowing additional protocols (MQTT, Modbus RTU, OPC-UA, etc.) to be added as independent modules in future iterations without touching the sensor or portal code.

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

### 2.2 Pin Assignment

```
ESP32 GPIO  | Signal        | Connected to
-----------+---------------+-------------------------------
GPIO 2      | LOADCELL_DOUT | HX711 DT  (data out)
GPIO 4      | LOADCELL_SCK  | HX711 PD_SCK (clock)
3.3 V       | HX711 VCC     | HX711 power (or 5 V)
GND         | HX711 GND     | Common ground
GPIO -1     | FORCE_AP_PIN  | (disabled; set a GPIO to enable factory-reset button)
```

> **Note:** `HX711_FAST_PROCESSOR = true` is mandatory for ESP32 because the core can
> toggle GPIO in < 0.4 us; without this flag the library inserts a software delay that
> breaks timing on fast MCUs.
> 
> **ESP32-S3 note:** GPIO 2 and GPIO 4 are valid on ESP32-S3 DevKitC-1; no pin changes needed.
> 
> **ESP32-C3 note:** GPIO 2 and GPIO 4 are valid on ESP32-C3-DevKitM-1; no pin changes needed.

---

## 3. Firmware Architecture

### 3.1 Guiding Principles

| Principle | Implementation |
|-----------|---------------|
| **Minimal coupling** | Modules share data only through `SharedState` (mutex-guarded). No direct function calls cross the core boundary. |
| **Deterministic sensor loop** | Scale task runs on core 0 with a fixed 30 ms tick, isolated from all networking latency. |
| **Always-reachable portal** | Soft-AP + DNS never stop regardless of STA status. Configuration is possible even without an upstream router. |
| **Robust persistence** | NVS writes are batched by category; calibration survives power cycles; WiFi creds are separate from calibration data so a factory WiFi reset cannot erase calibration. |
| **Zero-placeholder rule** | All code is complete and functional; no TODO stubs shipped in production. |

### 3.2 Module Dependency Graph

```
+-------------------------------------------------------------------+
|                          main.ino                                 |
|  (boot, FreeRTOS task creation, singleton wiring)                 |
+------+----------+-------------+----------------+-----------------+
       |          |             |                |
   config.h   Settings      SharedState      (future: MQTT, RTU...)
   (compile   Store         (mutex IPC)
   constants) (NVS/Prefs)       |
       |          |         +---+------------------------+
   ScaleSensor    |         |                            |
   (core 0)       +---------+  WifiManager       ModbusServer
                             (core 1)              (core 1)
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
  |   HX711 read -> EMA filter -> SharedState::setSnapshot()
  +-- Consume commands from SharedState (tare, calibrate, reset...)

Core 1 ---------------------------------------------------------------
  Task: "net"     Priority 2   Stack 8192 B
  |   WebPortal::handleClient()    HTTP + DNS per iteration
  |   WifiManager::loop()          STA reconnect supervision
  +-- ModbusServer::loop()         every 100 ms (MODBUS_POLL_MS)
        +-- reads SharedState::getSnapshot() -> updates Holding Regs

Arduino loop() -------------------------------------------------------
  Calls vTaskDelete(nullptr) immediately.
  All work is inside the two pinned tasks above.
```

**Single-core chips (ESP32-C3, ESP32-S3):** Both tasks are pinned to core 0. The scheduler time-slices them. This is acceptable because:
- Scale task runs every 30 ms with minimal work
- Network task is mostly idle (HTTP/DNS/Modbus are event-driven)
- Mutex-protected SharedState prevents data races

**Why two cores?** The HX711 requires precise clock timing (<= 1 us between pulses). Placing the HX711 driver on a core isolated from WiFi interrupt jitter prevents data corruption and missed samples.

---

## 4. Module Reference

### 4.1 `config.h` — Compile-Time Constants

All hardware pin numbers, timing intervals, stack sizes and feature switches are centralised here. No magic numbers appear elsewhere in the codebase.

| Constant | Default | Purpose |
|----------|---------|---------|
| `LOADCELL_DOUT_PIN` | 2 | HX711 data pin |
| `LOADCELL_SCK_PIN` | 4 | HX711 clock pin |
| `HX711_FAST_PROCESSOR` | true | Removes software delay for ESP32 |
| `HX711_READS` | 10 | Samples averaged per raw reading |
| `SCALE_SAMPLE_MS` | 30 | Sensor task period (ms) |
| `SCALE_ALPHA` | 0.35 | EMA low-pass filter coefficient |
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
| `FW_VERSION` | `0x0101` | Major.Minor encoded (1.1) |

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

### 4.3 `SharedState` — Inter-Core IPC

**Files:** [`SharedState.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/SharedState.h) / [`SharedState.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/SharedState.cpp)
**Mechanism:** Single FreeRTOS `SemaphoreHandle_t` mutex protecting a value-copy struct (`ScaleSnapshot`) and a one-deep command slot.

#### ScaleSnapshot (written by sensor core, read by network core)

| Field | Unit | Description |
|-------|------|-------------|
| `rawSample` | counts | HX711 reading with tare offset subtracted |
| `weightG` | grams | Instantaneous calibrated weight |
| `stableWeightG` | grams | EMA-filtered weight |
| `offsetCounts` | counts | Current tare offset |
| `countsPerKg` | counts/kg | Calibration slope |
| `calibrated` | bool | Slope is valid |

#### Command slot (written by network core, consumed by sensor core)

| Command enum | Value | Argument |
|-------------|-------|---------|
| `CMD_NONE` | 0 | — |
| `CMD_TARE` | 1 | — |
| `CMD_CALIBRATE` | 2 | Known weight in kg (float) |
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
HX711 (24-bit ADC, GPIO 2/4)
       |
       v  get_value()            <- blocks <= 40 ms (hxPoll)
  raw counts (offset subtracted by HX711 library)
       |
       v  / countsPerKg * 1000
  instantaneous weight (grams)
       |
       v  EMA: stableWeightG = alpha * inst + (1 - alpha) * prev
  stableWeightG (grams)
       |
       +-- stable > 5 g  ->  accumulate session totals
       |
       +-- SharedState::setSnapshot()  (mutex-guarded)
```

#### EMA filter

The exponential moving average (EMA) with alpha = 0.35 rejects noise from vibration while still tracking weight changes within ~5 sample periods (~150 ms).

| alpha | Effect |
|-------|--------|
| 0.10 | Very smooth, slow response (~10 samples = 300 ms) |
| 0.35 | **Default** — balanced for packaging-line use |
| 0.70 | Fast response, noisier output |

#### Two-point / Multi-Point calibration procedure

1. **Tare** — Empty platform. Send `CMD_TARE`. HX711 library sets internal offset to current raw average. Offset persisted to NVS.
2. **Single-point calibrate** — Place known reference mass (kg). Send `CMD_CALIBRATE` with the mass value. Firmware computes `countsPerKg = rawCounts / knownKg` and persists to NVS.
3. **Multi-point calibrate** — Capture 2–10 raw readings at different known masses via the web UI. Frontend computes linear regression: `slope` (counts/kg) and `intercept` (counts at 0 kg). Send both values to `/api/calibrate/multi`. Firmware stores them and uses `weight = (raw - intercept) / slope` for conversion.

---

### 4.5 `WifiManager` — Dual WiFi Mode (AP + STA Always-On)

**Files:** [`WifiManager.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/WifiManager.h) / [`WifiManager.cpp`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/WifiManager.cpp)
**Runs on:** Core 1, polled via `loop()`

The ESP32 WiFi stack supports simultaneous **AP + STA** mode (`WIFI_AP_STA`). Both interfaces are always active; the AP for configuration, the STA for upstream connectivity.

#### Boot sequence

```
begin(AppSettings)
  |
  +-> WiFi.mode(WIFI_AP_STA)
  |
  +-> WiFi.softAP("ENYX-SMARTHUB-AABBCCDDEEFF", "", channel=6, hidden=0, maxConn=4)
  |       AP is always started regardless of STA config.
  |       SSID suffix = last 3 bytes of MAC address.
  |
  +-> startSta(AppSettings)
        +- wifiMode == WIFI_MODE_PSK  -> WiFi.begin(ssid, password)
        +- wifiMode == WIFI_MODE_ENT  -> esp_wifi_sta_wpa2_ent_set_*() + WiFi.begin(ssid)
        +- wifiMode == WIFI_MODE_NONE -> STA not started (AP only)
```

#### Reconnection loop (`loop()`)

Called every network task iteration. Checks STA state every 5 s; if disconnected and a saved SSID exists, re-initiates connection without restarting the AP or portal.

#### Key design decisions

- **AP never stops:** Even if STA credentials are wrong, the portal remains accessible on `192.168.4.1`.
- **Non-blocking connect:** `WiFi.begin()` is non-blocking; `loop()` polls `WiFi.status()` and retries on `WL_DISCONNECTED` / `WL_CONNECTION_LOST`.
- **WPA2-Enterprise:** Uses `esp_wifi_sta_wpa2_ent_*` API for PEAP/MSCHAPv2.

---

### 4.6 `ModbusServer` — Modbus TCP Register Map

**Files:** [`ModbusServer.h`](file:///home/almuzky/E-Tani-Smart-Hub/firmware/weight%20transmitter/src/ModbusServer.h) / `ModbusServer.cpp`
**Library:** `emelianov/modbus-esp8266 @ 4.1.0`
**Runs on:** Core 1, polled every `MODBUS_POLL_MS` = 100 ms
**Port:** 502 (TCP)

The device acts as a **Modbus TCP server** (formerly "slave"). Holding registers (FC 03/06/16) are used. All multi-word values are **big-endian, high word first** (IEEE 754 float split into two 16-bit registers).

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
| `GET` | `/api/status` | — | JSON snapshot: weight, calibration, WiFi, uptime, session |
| `GET` | `/api/config` | — | Return stored WiFi + calibration config as JSON |
| `POST` | `/api/wifi` | Form: `mode`, `ssid`, `psk`, `eid`, `eusr`, `epwd` | Save WiFi credentials + reconnect STA |
| `POST` | `/api/tare` | — | Issue `CMD_TARE` |
| `POST` | `/api/calibrate` | Query: `kg=<float>` | Issue `CMD_CALIBRATE` with known weight in kg |
| `POST` | `/api/calibrate/multi` | Query: `slope=<float>&intercept=<float>` | Apply multi-point regression (store slope + intercept) |
| `POST` | `/api/totals/reset` | — | Issue `CMD_RESET_SESSION` |
| `POST` | `/api/portal/force` | — | Issue `CMD_WIPE_WIFI` (forget STA, reboot into AP) |
| `POST` | `/api/factory` | — | Wipe all NVS + reboot |
| `GET` | `/*` | — | Captive redirect -> `/` (Android/iOS/Windows probes + unknown hosts) |

#### Response formats

Most mutation endpoints return plain JSON:

```json
{ "ok": true, "message": "English status text" }
```

`/api/status` returns a flat JSON object with live telemetry:

```json
{
  "weightKg": 1.234,
  "stableG": 1234.0,
  "raw": 56789.0,
  "offset": 12345.0,
  "countsPerKg": 45678.0,
  "intercept": 0.0,
  "calibrated": true,
  "sensorReady": true,
  "totalG": 5432.0,
  "sampleCount": 42,
  "minG": 100.0,
  "maxG": 2345.0,
  "modbusClients": 1,
  "uptime": 3600,
  "fw": "1.1",
  "wifi": {
    "modeName": "WPA2-PSK",
    "mode": 1,
    "ssid": "MyNet",
    "status": "connected",
    "rssi": -45,
    "staIp": "192.168.1.100",
    "apSsid": "ENYX-SMARTHUB-AABBCCDDEEFF",
    "apIp": "192.168.4.1"
  }
}
```

Unknown `/api/*` paths return:

```json
{ "ok": false, "message": "API endpoint not found" }
```

#### WiFi configuration flow

```
User opens portal
  -> GET /api/status  (UI shows current mode and STA status)
  -> GET /api/config  (UI pre-fills SSID / PSK / enterprise fields)
  -> User selects mode + fills fields
  -> POST /api/wifi  (form-encoded: mode, ssid, psk, eid, eusr, epwd)
       -> Settings saved to NVS via saveWifi()
       -> WifiManager::applySettings() -> STA reconnect (non-blocking)
       -> AP stays up
  -> User polls GET /api/status to see STA connection result
```

---

## 5. Boot Sequence

```
setup()
  |
  +- Serial.begin(115200)
  +- gSettings.load(gAppSettings)        <- restore NVS settings
  +- checkForceApButton()                <- hold FORCE_AP_PIN to wipe WiFi creds
  +- gShared.begin()                     <- create mutex, zero state
  +- gScale.begin()                      <- HX711 power up, restore calibration
  +- gWifi.begin()                       <- start AP + STA (if configured)
  +- gModbus.begin() + startServer()     <- register holding regs, listen :502
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
          |  HX711 (GPIO 2, 4)                   |
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
  Phone /     |   Configuration
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
```

Both interfaces run concurrently. The AP is **never disabled** — if STA credentials are wrong or the upstream router is offline, the operator can always connect to the AP, access the portal, and reconfigure without a hardware reset.

---

## 8. NVS Layout

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

**Factory reset** clears all keys in the namespace then calls `ESP.restart()`.

---

## 9. Security Considerations

| Area | Current posture | Recommendation for production |
|------|----------------|-------------------------------|
| AP authentication | Open (no WPA) | Intentional for captive portal. Set `AP_SSID_PASSWORD` for secure sites. |
| Portal auth | None (IP-based trust) | Add HTTP Basic Auth or a session token. |
| Modbus TCP | No authentication (standard protocol) | Isolate on VLAN; use firewall/ACL rules. |
| NVS encryption | Off | Enable Flash Encryption + NVS Encryption via ESP-IDF menuconfig. |
| OTA updates | Not implemented | Add ArduinoOTA or ESP32 HTTP OTA for field updates. |

---

## 10. Extension Roadmap (Multi-Protocol)

The architecture allows additional protocol modules to be added to core 1 without modifying `ScaleSensor` or `SharedState`:

```
Planned protocols (plug in on core 1):
  +- MQTT publish  -> SharedState::getSnapshot() -> JSON to broker
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

## 11. Build & Flash

### Prerequisites

```bash
pip install platformio
```

### Build (ESP32-WROOM-32)

```bash
cd "firmware/weight transmitter"
pio run
```

### Build (ESP32-S3 / ESP32 v4)

```bash
cd "firmware/weight transmitter"
pio run -e esp32s3
```

### Build (ESP32-C3-MINI)

```bash
cd "firmware/weight transmitter"
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

---

## 12. File Structure

```
firmware/weight transmitter/
+-- platformio.ini              <- build config, SPIFFS filesystem, lib dependencies
+-- firmware.md                 <- this document
+-- data/                       <- SPIFFS filesystem assets (HTML/CSS/JS separated)
|   +-- index.html              <- modern responsive captive portal & dashboard UI
|   +-- css/
|   |   +-- style.css           <- dark emerald theme stylesheet
|   +-- js/
|       +-- app.js              <- client-side telemetry polling & REST interaction
+-- src/
    +-- main.ino                <- boot, task creation, singleton wiring
    +-- config.h                <- ALL compile-time constants
    +-- SharedState.h/.cpp      <- mutex-guarded inter-core data bus + command slot
    +-- Settings.h/.cpp         <- NVS persistence (AppSettings struct)
    +-- Scale.h/.cpp            <- HX711 acquisition, EMA filter, calibration
    +-- WifiManager.h/.cpp      <- AP+STA dual-mode WiFi management
    +-- ModbusServer.h/.cpp     <- Modbus TCP server, holding register publish
    +-- WebPortal.h/.cpp        <- HTTP captive portal, SPIFFS static server & REST API
```

---