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
// ESP32-S3: HX711 is bit-banged via HX711 library, safe to share bus
// with hardware SPI on other pins.
#define LOADCELL_DOUT_PIN    14     // GPIO 14 (DOUT)
#define LOADCELL_SCK_PIN     15     // GPIO 15 (PD_SCK)
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

// ------------------------- W5500 Ethernet ---------------------------
// Match proven esp32s3-ethernet firmware wiring with Ethernet3 library.
//   W5500 SCK  -> GPIO 12
//   W5500 MISO -> GPIO 13
//   W5500 MOSI -> GPIO 11
//   W5500 CS   -> GPIO 10
//   W5500 RST  -> GPIO 9
// HX711 stays on GPIO 14/15 so there is no SPI bus conflict.
// OLED stays on GPIO 16/17 so there is no SPI bus conflict.
#define W5500_SCK_PIN       12
#define W5500_MISO_PIN      13
#define W5500_MOSI_PIN      11
#define W5500_CS_PIN        10
#define W5500_RST_PIN       9
#define W5500_USE_DHCP      true
#define W5500_STATIC_IP     "192.168.1.100"
#define W5500_STATIC_GATEWAY "192.168.1.1"
#define W5500_STATIC_SUBNET "255.255.255.0"
#define W5500_STATIC_DNS    "8.8.8.8"

// ------------------------- OLED Display -----------------------------
// I2C (Wire) bus on ESP32-S3.
//   OLED SDA -> GPIO 16
//   OLED SCL -> GPIO 17
#define OLED_SDA_PIN        16
#define OLED_SCL_PIN        17
#define OLED_WIDTH          128
#define OLED_HEIGHT         64
#define OLED_RESET_PIN     -1

// ------------------------- Transport mode ---------------------------
#define TRANSPORT_WIFI      0
#define TRANSPORT_ETHERNET  1
#define DEFAULT_TRANSPORT   TRANSPORT_WIFI

// Network task watchdog timeout (ms). Must be larger than any expected
// blocking WiFi/Ethernet driver call so the portal and OLED stay reachable
// during radio flakiness.
#define NET_WATCHDOG_TIMEOUT_MS  15000

// ------------------------- Dual core task layout ----------------------
// ESP32-S3 is dual-core Xtensa LX7. True pinning:
//   core 0 : HX711 read + filter + calibration math
//   core 1 : networking (web portal + DNS + Modbus TCP + OLED updates)
#define CORE_SCALE          0
#define CORE_NETWORK        1
#define TASK_STACK_SCALE    4096
#define TASK_STACK_NETWORK  8192

// Optional button to force the setup (AP) mode / factory reset on boot.
// Set to a GPIO number (e.g. 8 or 9) to enable, -1 to disable.
#define FORCE_AP_PIN        -1
#define FORCE_AP_HOLD_MS    3000

// ------------------------- Persistence --------------------------------
#define PREF_NAMESPACE      "scale"

// ------------------------- Firmware ----------------------------------
#define FW_VERSION          0x0104   // major<<8 | minor  (1.4)

// ------------------------- State Machine ------------------------------
#define STATE_MACHINE_TASK_PRIORITY  2
#define STATE_MACHINE_TASK_STACK    4096

// ------------------------- Event Bus ---------------------------------
#define EVENT_BUS_QUEUE_SIZE  32

// ------------------------- MQTT --------------------------------------
#define MQTT_SERVER          "192.168.1.100"
#define MQTT_PORT            1883
#define MQTT_CLIENT_ID       "enyx-weight-transmitter"
#define MQTT_USERNAME        ""
#define MQTT_PASSWORD        ""
#define MQTT_TOPIC_PREFIX    "smartfarm"
#define MQTT_TELEMETRY_INTERVAL_MS 5000
#define MQTT_KEEPALIVE       60
#define MQTT_QOS             0
#define MQTT_RETAIN          0

// ------------------------- Driver Registry ---------------------------
#define DRIVER_REGISTRY_MAX_SENSORS    8
#define DRIVER_REGISTRY_MAX_ACTUATORS  8
#define DRIVER_REGISTRY_MAX_PROTOCOLS  8

// ------------------------- Config Validation -------------------------
#define CONFIG_MIN_SSID_LEN      1
#define CONFIG_MAX_SSID_LEN      32
#define CONFIG_MIN_PSK_LEN       8
#define CONFIG_MAX_PSK_LEN       63
#define CONFIG_MIN_ENT_USER_LEN  1
#define CONFIG_MAX_ENT_USER_LEN  64
#define CONFIG_MIN_ENT_PASS_LEN  1
#define CONFIG_MAX_ENT_PASS_LEN  64

// Optional deep sleep for battery/solar deployments. Default disabled so
// existing hardware behavior is unchanged.
#ifndef DEEP_SLEEP_ENABLED
#define DEEP_SLEEP_ENABLED 0
#endif

// ------------------------- Arduino OTA -------------------------------
// Hostname used for mDNS / OTA discovery.
// Empty string = fallback to AP_SSID_PREFIX + last 6 of MAC.
#define OTA_HOSTNAME       ""
// Password for OTA uploads. Empty = no auth.
#define OTA_PASSWORD       "enyx-weight-transmitter"
// TCP port for OTA (default 3232).
#define OTA_PORT           3232
// Maximum OTA binary size in bytes. Leave 0 to use default partition size.
#define OTA_MAX_BINARY_SIZE 0
#endif // SCALE_CONFIG_H
