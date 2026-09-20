#ifndef SCALE_CONFIG_H
#define SCALE_CONFIG_H

// =====================================================================
//  E-Tani Smart Hub - Weight Transmitter configuration
//  All pins / constants / feature switches live here.
// =====================================================================

// ------------------------- HX711 load cell --------------------------
// Wire the HX711 as follows:
//   HX711 DT  (DOUT / data)      -> GPIO pin below
//   HX711 PD_SCK (clock)         -> GPIO pin below
//   HX711 VCC / GND              -> 3.3V / GND (or 5V, see module)
//
// ESP32-S3 note: GPIO 2 and GPIO 4 are valid on ESP32-S3 DevKitC-1.
#define LOADCELL_DOUT_PIN    2      // GPIO 2  (DOUT)
#define LOADCELL_SCK_PIN     4      // GPIO 4  (PD_SCK)
#define HX711_FAST_PROCESSOR true   // ESP32 can toggle IO < 0.4us -> must be true
#define HX711_READS          10     // samples averaged per reading
#define SCALE_SAMPLE_MS      30     // sensor task period
#define SCALE_ALPHA          0.35f  // low-pass filter factor for stable weight

// ------------------------- Soft AP (captive portal) ------------------
#define AP_SSID_PREFIX      "ENYX-SMARTHUB-"
#define AP_SSID_PASSWORD    ""       // empty = open config network
#define AP_CHANNEL          6
#define AP_MAX_CONNECTIONS  4
#define AP_HIDDEN           0      // 0 = broadcast SSID, 1 = hidden

// If you want a WPA2-secured config AP (8..63 chars), set a password here.
// NOTE: an open AP makes the mobile captive-portal flow the simplest.

// ------------------------- Modbus TCP --------------------------------
#define MODBUS_PORT         502
#define MODBUS_POLL_MS      100      // publish interval

// ------------------------- Web portal --------------------------------
#define WEB_PORT            80

// Grace period inserted between answering a mutating HTTP request and
// touching the radio. The browser must receive its response first, otherwise
// "Apply Configuration" looks like it never answers.
#define WIFI_APPLY_DELAY_MS      750

// When a calibration is applied from the web portal the coefficients are
// persisted to NVS and the transmitter restarts, so the brand new
// calibration is loaded exactly like after a power cycle.
// Value = delay before the restart; 0 restarts as soon as the HTTP response
// has been flushed and no scale command is pending anymore.
#define CALIBRATION_REBOOT_DELAY_MS  1200

// Extra time granted to the sensor task to consume a queued command before
// a scheduled restart is executed.
#define REBOOT_GRACE_MS          500

// ------------------------- Dual core task layout ----------------------
// ESP32 WROOM-32 has 2 cores. We pin:
//   core 0 : HX711 read + filter + calibration math
//   core 1 : networking (web portal + DNS + Modbus TCP)
//
// ESP32-C3 / ESP32-S3 single-core: both tasks run on core 0.
#if defined(ESP32C3) || defined(ESP32S3)
#define CORE_SCALE          0
#define CORE_NETWORK        0
#else
#define CORE_SCALE          0
#define CORE_NETWORK        1
#endif
#define TASK_STACK_SCALE    4096
#define TASK_STACK_NETWORK  8192

// Optional button to force the setup (AP) mode / factory reset on boot.
// Set to a GPIO number (e.g. 15) to enable, -1 to disable.
#define FORCE_AP_PIN        -1
#define FORCE_AP_HOLD_MS    3000

// ------------------------- Persistence --------------------------------
#define PREF_NAMESPACE      "scale"

// ------------------------- Firmware ----------------------------------
#define FW_VERSION          0x0103   // major<<8 | minor  (1.3)
#endif // SCALE_CONFIG_H