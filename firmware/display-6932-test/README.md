# GN6932 / TA6932 / AiP6932 Dual Display Test Firmware

ESP32 firmware for validating two compatible GN6932-family LED display driver
chips. CLK and DIN are shared; each chip has an independent STB by default.
The driver uses the common GN/TA/AiP6932 3-wire protocol and does not require
an external library.

## Build and flash

```bash
cd firmware/display-6932-test
pio run -t upload
pio device monitor --baud 115200
```

## Pinout

| Role | GPIO | Direction |
|------|------|-----------|
| CLK | 18 | Output |
| DIN | 19 | Output |
| STB chip 1 | 23 | Output |
| STB chip 2 | 23 | Output |
| VDD | 5 V supply | Power |
| GND | ESP32 GND | Power |

Both STB inputs are connected to GPIO 23 in the current wiring. The firmware
uses the shared-STB mode when `CHIP1_STB` and `CHIP2_STB` are equal.

The default build starts with the drivers disabled, waits for the supply to
settle, and uses brightness 1. The full-segment/high-current test is disabled
by default; enable it only after verifying the power supply with
`-D ENABLE_FULL_CURRENT_TEST=1`.

## Brownout reset troubleshooting

`Brownout detector was triggered` means the ESP32 supply fell below its safe
voltage threshold. `mode:DIO, clock div:2` is normal bootloader output and is
not the cause. Power the ESP32 from a stable 5 V USB supply capable of at
least 1 A, power the LED drivers from a suitable separate 5 V rail, and join
the grounds at one point. Add 100–470 uF near the ESP32 and 100 uF plus a
100 nF ceramic capacitor near each driver. Do not power both drivers and the
ESP32 through a weak 3.3 V regulator or a small USB-serial adapter.

## Diagnostic sequence

1. Grid 1 through 16, each with all 8 segments on (`0xFF`)
2. Grid 1 through 16, each with cumulative patterns:
   `0x01`, `0x03`, `0x07`, `0x0F`, `0x1F`, `0x3F`, `0x7F`, `0xFF`
3. Brightness sweep from 0 to 7

Each pattern remains visible for 1000 ms (1 second). The loop is non-blocking and reports
the grid, bit count, and hexadecimal segment mask through the serial console.

## Manual testing from Serial Monitor

Set the monitor to **115200 baud** and send one command per line. Manual
commands pause the automatic test until `auto` is sent.
In PlatformIO Monitor, press **Enter** after the command. The project is
configured with `monitor_eol = CRLF`, so the firmware can detect the end of
the command.

```text
help
grid 3 0xA5
grid 16 255
bit 3 1
bit 3 8
clear
auto
```

Command behavior:

- `grid <1-16|all> <mask>` selects one grid, or all grids, and writes the
  exact 8-bit mask.
  The mask accepts decimal or hexadecimal notation (`0x00`–`0xFF`).
- `char <1-16|all> <symbol>` uses the calibrated segment mapping to show a
  character on one grid or all 16 grids. Supported symbols are `0`–`9`,
  `A`–`Z`, and `DP`.
- `section <1|2|3> <text>` writes a complete physical display section with
  its configured grid order and DP indicators.
- `bit <1-16> <1-8>` selects one grid and writes a cumulative mask:
  `1` → `0x01`, `2` → `0x03`, ..., `8` → `0xFF`.
- `scan segment [1-16]` scans every mask from `0x00` through `0xFF` on one
  grid. If the grid is omitted, grid 1 is used.
- While scanning, press **Enter** on an empty line to pause. Press **Enter**
  again to continue. Each mask uses the current 1000 ms frame interval.
- `clear` turns all grids off and remains in manual mode.
- `stop` stops the scan and clears the display.
- `auto` resumes the automatic grid test from grid 1.

### Segment calibration

The installed board uses this segment mapping on every grid:

| Segment | Mask |
|---------|------|
| A | `0x20` |
| B | `0x80` |
| C | `0x01` |
| D | `0x02` |
| E | `0x08` |
| F | `0x10` |
| G | `0x40` |
| DP | `0x04` |

Examples:

```text
char 1 A
char 1 1
char 1 DP
char 16 8
char 1 Z
char 16 M
char all A
section 1 12345
section 2 ABCDE
section 3 123456
grid all 0xFF
```

Letters that cannot be represented perfectly by seven segments use the
closest readable seven-segment approximation.

### Display section layouts

| Section | Character grids | Automatic DP grids | Text length |
|---------|-----------------|--------------------|-------------|
| 1 | 1, 2, 3, 4, 5 | 1, 2, 3, 4, 5 | 5 |
| 2 | 6, 7, 8, 9, 10 | 6, 7, 8, 9, 10 | 5 |
| 3 | 11, 12, 13, 14, 15, 16 | 11, 12, 13, 14, 15, 16 | 6 |

Examples:

```text
section 1 12345
section 2 ABCDE
section 3 123456
```

The section command accepts digits and letters. DP is added automatically to
every grid in the selected section.

When a command is received, the monitor prints `RX: ...` followed by the
manual result. If `RX:` does not appear, upload the latest firmware again and
make sure no other serial application is using the COM port.

## Chip protocol

- 3-wire serial: CLK, DIN, STB
- Rising-edge sampling, LSB first
- Auto-increment write command: `0x40`
- Fixed-address write command: `0x44`
- Display control command: `0x80 | 0x08 | brightness`
- Grid address: `0xC0 | grid`, where grid is 0–15

The driver releases STB after each mode command before sending the address and
segment data. This framing is required for stable repeated writes; otherwise
repeating a command such as `grid 1 0xFF` can appear to shift between grids.
