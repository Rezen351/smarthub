# GN6932 / TA6932 / AiP6932 Dual Display Test — Schematic

## Wiring

| Signal | ESP32 GPIO | Chip 1 | Chip 2 |
|--------|------------|--------|--------|
| CLK | 18 | CLK | CLK |
| DIN | 19 | DIN | DIN |
| STB chip 1 | 23 | STB | — |
| STB chip 2 | 23 | — | STB |
| VDD | 5 V ± 10% | VDD (pin 18) | VDD (pin 18) |
| GND | GND | GND (pin 5) | GND (pin 5) |

CLK and DIN are shared. Both STB inputs use the shared GPIO 23 wire in the
current wiring, so both controllers receive the same commands and display
frames.

## Protocol

- STB is active LOW. End the mode-command transaction with STB HIGH before
  starting the address/data transaction.
- Data is transmitted LSB first and sampled on the rising edge of CLK.
- Auto-increment write: send `0x40` and release STB, then send address
  `0xC0 | grid` and segment bytes in a new transaction.
- Fixed-address write: send `0x44` and release STB, then send address
  `0xC0 | grid` and one segment byte in a new transaction.
- Display control: `0x80 | 0x08 | brightness`, where brightness is 0–7.
- Grid addresses are `0xC0` through `0xCF`. `0x00 | grid` is not a valid
  grid address for this controller family.

## Electrical notes

- A repeated `Brownout detector was triggered` reset is a power problem.
  `mode:DIO, clock div:2` is normal ESP32 boot output. Use a stable 5 V
  supply rated for the ESP32 plus both LED drivers, or separate the driver
  supply while keeping grounds common.
- Add 100–470 uF near the ESP32 and 100 uF plus 100 nF ceramic near each
  driver. Do not route driver LED current through the ESP32 3.3 V regulator.
- Default display mode is common cathode, 8 segments × 16 grids.
- SEG pins are P-channel open drain and GRID pins are N-channel open drain;
  do not reverse these connections.
- Place a decoupling capacitor close to each controller's VDD–GND pins.
- The ESP32 GPIO is not 5 V tolerant. Add a suitable level shifter when the
  controller input high level is not guaranteed at 3.3 V.
- Optional 100 pF capacitors on DIN, CLK, and STB can reduce interference.

## Test sequence

The firmware first tests grid 1 through grid 16 individually with all eight
segment bits enabled (`0xFF`). It then tests every grid independently using
the cumulative masks `0x01`, `0x03`, `0x07`, `0x0F`, `0x1F`, `0x3F`,
`0x7F`, and `0xFF`. Each frame is held for 1000 ms (1 second).

## Serial manual test commands

At 115200 baud, send one command per line:

```text
grid 3 0xA5
bit 3 4
clear
auto
```

`grid <1-16> <mask>` writes the exact 8-bit mask to one grid. `bit <1-16>
<1-8>` writes cumulative masks from `0x01` through `0xFF`. Manual commands
pause the automatic sequence; `auto` resumes it.

The calibrated segment mapping is shared by all grids:

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

Use `char 1 A`, `char 1 Z`, `char 1 1`, or `char 1 DP` to test the calibrated
output on grid 1. The grid selector can be any value from 1 through 16, or
`all` to write the same character to every grid. For example:

```text
char all A
grid all 0xFF
```

`grid all <mask>` writes the same raw mask to all 16 grids.
Letters `A`–`Z` use the closest readable seven-segment approximation when a
letter cannot be drawn perfectly.

## Configured display sections

Use these commands to write each physical section:

```text
section 1 12345
section 2 ABCDE
section 3 123456
```

| Section | Character grids | Automatic DP grids | Text length |
|---------|-----------------|--------------------|-------------|
| 1 | 1, 2, 3, 4, 5 | 1, 2, 3, 4, 5 | 5 |
| 2 | 6, 7, 8, 9, 10 | 6, 7, 8, 9, 10 | 5 |
| 3 | 11, 12, 13, 14, 15, 16 | 11, 12, 13, 14, 15, 16 | 6 |

The firmware applies the calibrated character masks and adds DP to every
grid in the selected section automatically.

## Physical display illustration

The display is divided into three physical sections. `DP` marks a decimal
point indicator; the number in brackets is the controller grid address.

```text
SECTION 1

  [7-segment] [7-segment] [7-segment] [7-segment] [7-segment]
  grid 1      grid 2      grid 3      grid 4      grid 5
  [DP]        [DP]        [DP]        [DP]        [DP]

  Firmware order: grid 1, grid 2, grid 3, grid 4, grid 5
  DP indicators:  grid 1, grid 2, grid 3, grid 4, grid 5


SECTION 2

  [7-segment] [7-segment] [7-segment] [7-segment] [7-segment]
  grid 6      grid 7      grid 8      grid 9      grid 10
  [DP]        [DP]        [DP]        [DP]        [DP]

  Firmware order: grid 6, grid 7, grid 8, grid 9, grid 10
  DP indicators:  grid 6, grid 7, grid 8, grid 9, grid 10


SECTION 3

  [7-segment] [7-segment] [7-segment] [7-segment] [7-segment] [7-segment]
  grid 11     grid 12     grid 13     grid 14     grid 15     grid 16
  [DP]        [DP]        [DP]        [DP]        [DP]        [DP]

  Firmware order: grid 11, grid 12, grid 13, grid 14, grid 15, grid 16
  DP indicators:  grid 11, grid 12, grid 13, grid 14, grid 15, grid 16
```

The logical command layout is intentionally kept separate from the physical
drawing. This makes the grid order explicit even when the PCB routes the
indicators and seven-segment digits through non-sequential controller grids.

For random segment mapping, use `scan segment [1-16]`. The scanner displays
every mask from `0x00` through `0xFF` on the selected grid. Press Enter on an
empty line to pause and press Enter again to continue; `stop` ends the scan.
