#ifndef SCALE_CONFIG_H
#define SCALE_CONFIG_H

// =====================================================================
//  enyx-weight-transmitter configuration
//  ESP32-S3 dedicated build (GN6932 display + 4x6 keypad + WiFi-only)
// =====================================================================

// ------------------------- HX711 load cell --------------------------
// Wire the HX711 as follows:
//   HX711 DT  (DOUT / data)      -> GPIO pin below (GPIO 13)
//   HX711 PD_SCK (clock)         -> GPIO pin below (GPIO 14)
//   HX711 VCC / GND              -> 3.3V / GND (or 5V, see module)
#define HX711_FAST_PROCESSOR true   // ESP32 can toggle IO < 0.4us -> must be true
#define HX711_READS          10     // samples averaged per reading
#define SCALE_SAMPLE_MS      30     // sensor task period
#define SCALE_MEDIAN_WINDOW  5      // reject isolated HX711 spikes
#define SCALE_FILTER_WINDOW  10     // recent filtered samples used for stability
#define SCALE_SLOW_ALPHA      0.05f // smoothing while the load is stable
#define SCALE_FAST_ALPHA      0.65f // response while the load is changing
#define SCALE_CHANGE_THRESHOLD_G 20.0f
#define SCALE_STABILITY_RANGE_G 4.0f
#define SCALE_STABILITY_HOLD_MS 800
#define SCALE_ZERO_LAMP_BAND_G 2.0f   // |weight| within this band lights the ZERO lamp

// ------------------------- Scale Filter & Anti-Drift -----------------
#define SCALE_DIVISION_G            2.0f    // Quantized display interval (d = 2g = 0.002 kg)
#define SCALE_DEADBAND_G            3.0f    // Freeze window (locks reading when delta <= 3g)
#define SCALE_BREAKOUT_THRESHOLD_G  15.0f   // Instant breakout threshold for intentional weight changes
#define SCALE_AZT_ENABLED           1       // Automatic Zero Tracking (absorbs slow zero drift)
#define SCALE_AZT_BAND_G            4.0f    // Max drift from 0g that AZT will track
#define SCALE_AZT_RATE_G_PER_S      0.5f    // Maximum drift rate tracked per second (0.5g/s)

// ------------------------- Soft AP (captive portal) ------------------
#define AP_SSID_PREFIX      "ENYX-WT-"
#define AP_SSID_PASSWORD    ""       // empty = open config network
#define AP_CHANNEL          6
#define AP_MAX_CONNECTIONS  4
#define AP_HIDDEN           0      // 0 = broadcast SSID, 1 = hidden

// ------------------------- WiFi STA IPv4 ----------------------------
#define WIFI_USE_DHCP       true
#define WIFI_STATIC_IP      "192.168.1.100"
#define WIFI_STATIC_GATEWAY "192.168.1.1"
#define WIFI_STATIC_SUBNET  "255.255.255.0"
#define WIFI_STATIC_DNS     "8.8.8.8"

// ------------------------- Modbus TCP --------------------------------
#define MODBUS_PORT         502
#define MODBUS_POLL_MS      100      // publish interval

// ------------------------- Web portal --------------------------------
#define WEB_PORT            80

#define WIFI_APPLY_DELAY_MS      750
#define CALIBRATION_REBOOT_DELAY_MS  1200
#define REBOOT_GRACE_MS          500

// ------------------------- Ethernet & Transport ---------------------
// Ethernet is completely disabled (WiFi-only operation)
#define ETHERNET_ENABLED    0
#define TRANSPORT_WIFI      0
#define TRANSPORT_ETHERNET  1
#define DEFAULT_TRANSPORT   TRANSPORT_WIFI

// ------------------------- ESP32-S3 Hardware Pinout -----------------
// Matched to ESP32-S3-DEVKITC-1-N16R8V schematic
#define LOADCELL_DOUT_PIN   13       // HX-DT  (J1_19)
#define LOADCELL_SCK_PIN    14       // HX-SCK (J1_20)

#define BUTTON_ROW_1_PIN    38       // R1 (J3_10)
#define BUTTON_ROW_2_PIN    48       // R2 (J3_16)
#define BUTTON_ROW_3_PIN    18       // R3 (J1_11)
#define BUTTON_ROW_4_PIN    47       // R4 (J3_17)

#define BUTTON_COL_1_PIN    41       // C1 (J3_7)
#define BUTTON_COL_2_PIN    2        // C2 (J3_5)
#define BUTTON_COL_3_PIN    1        // C3 (J3_4)
#define BUTTON_COL_4_PIN    42       // C4 (J3_6)
#define BUTTON_COL_5_PIN    40       // C5 (J3_8)
#define BUTTON_COL_6_PIN    39       // C6 (J3_9)

#define STATUS_RGB_LED_PIN  -1       // Disabled (GPIO 38 assigned to Keypad R1)
#define DISPLAY6932_CLK_PIN 20       // D-CLK (J3_19 / USB_D+)
#define DISPLAY6932_DIN_PIN 19       // D-DIN (J3_20 / USB_D-)
#define DISPLAY6932_STB_PIN 21       // D-STB (J3_18)
#define BUZZER_PIN          5        // BUZZER (J1_5)

#define W5500_USE_DHCP      true
#define W5500_STATIC_IP     "192.168.1.100"
#define W5500_STATIC_GATEWAY "192.168.1.1"
#define W5500_STATIC_SUBNET "255.255.255.0"
#define W5500_STATIC_DNS    "8.8.8.8"

// Network task watchdog timeout (ms)
#define NET_WATCHDOG_TIMEOUT_MS  150008

// ------------------------- Dual core task layout ----------------------
// ESP32-S3 dual-core Xtensa LX7:
//   core 0 : HX711 read + filter + calibration math
//   core 1 : networking (web portal + DNS + Modbus TCP + GN6932 display updates)
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
#define FW_VERSION          0x0107   // major<<8 | minor  (1.7)

// ------------------------- State Machine ------------------------------
#define STATE_MACHINE_TASK_PRIORITY  2
#define STATE_MACHINE_TASK_STACK    4096

// ------------------------- Event Bus ---------------------------------
#define EVENT_BUS_QUEUE_SIZE  64



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

// ------------------------- GN6932 Display ------------------------------
// Mutually exclusive with SSD1306 OLED. When enabled, the GN/TA/AiP6932
// ------------------------- GN6932 Display ------------------------------
// Dedicated 3-section 7-segment display (weight, unit price, total price)
#define DISPLAY_USE_6932    1

// ------------------------- Button Matrix -------------------------------
// 4x6 Keypad Matrix enabled
#define KEYPAD_ENABLED      1

// Press-and-hold duration (ms) on M1-M3 that saves a preset instead of
// recalling it. A short press still recalls the preset on key release.
#define KEYPAD_LONG_PRESS_MS 1500

// M4 network info page timings: page 1 (mode + link status) then page 2
// (IP address split over the three sections) before the live display resumes.
#define NET_INFO_PAGE1_MS 1200
#define NET_INFO_PAGE2_MS 2800

// ------------------------- Buzzer --------------------------------------
// Passive piezo buzzer driven by LEDC PWM on GPIO 5
#define BUZZER_ENABLED      1

// LEDC PWM configuration for the buzzer tone.
#define BUZZER_LEDC_CHANNEL      0
#define BUZZER_FREQ_HZ           2700
#define BUZZER_RESOLUTION_BITS   8
#define BUZZER_DUTY_ON           128      // 50% of 8-bit

// Beep pattern timings (ms). Each step is an on-phase followed by an
// off-phase; a zero off-phase ends the pattern immediately.
#define BUZZER_STARTUP_BEEP_MS   80
#define BUZZER_STARTUP_GAP_MS    80
#define BUZZER_PRESS_MS          25
#define BUZZER_ERROR_BEEP_MS     100
#define BUZZER_ERROR_GAP_MS      100
#define BUZZER_ERROR_REPEAT      3
#define BUZZER_SELFTEST_GAP_MS   200
#define BUZZER_CONFIRM_BEEP_MS   80      // preset saved: beep, beep, beeeep
#define BUZZER_CONFIRM_GAP_MS    80
#define BUZZER_CONFIRM_LONG_MS   250

// ------------------------- Arduino OTA -------------------------------
// Hostname used for mDNS / OTA discovery.
// Empty string = fallback to AP_SSID_PREFIX + last 6 of MAC.
#define OTA_HOSTNAME       ""
// Password for OTA uploads. Empty = no auth (recommended: set locally in production).
#define OTA_PASSWORD       ""
// TCP port for OTA (default 3232).
#define OTA_PORT           3232
// Maximum OTA binary size in bytes. Leave 0 to use default partition size.
#define OTA_MAX_BINARY_SIZE 0
#endif // SCALE_CONFIG_H
