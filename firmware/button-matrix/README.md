# Button Matrix Scanner Firmware

ESP32 firmware for scanning a 4x5 matrix (20 buttons) using internal pull-ups. No external 3.3V or GND headers are needed for the matrix.

## Build & Flash

```bash
cd firmware/button-matrix
pio run -t upload && pio device monitor --baud 115200
```

## Serial Output

```json
{"ts":1024,"btn":0,"event":"pressed"}
{"ts":1034,"btn":0,"event":"released"}
```

## Pinout

| Role | GPIO | Direction |
|------|------|-----------|
| Row 1 | 14 | Output |
| Row 2 | 18 | Output |
| Row 3 | 5 | Output |
| Row 4 | 12 | Output |
| Col 1 | 21 | Input (pull-up) |
| Col 2 | 22 | Input (pull-up) |
| Col 3 | 17 | Input (pull-up) |
| Col 4 | 16 | Input (pull-up) |
| Col 5 | 4 | Input (pull-up) |
