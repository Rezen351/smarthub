# HX711 Raw Data Test

Standalone ESP32-S3 diagnostic firmware for the HX711 interface.

## Wiring

| HX711 | ESP32-S3 |
|---|---|
| DOUT / DT | GPIO 13 |
| SCK / CLK | GPIO 14 |
| GND | GND |
| VCC | Supported module supply |

## Run

```bash
pio run -t upload
pio device monitor -b 115200
```

Expected output while applying and removing weight:

```text
[DATA] sample=1 raw=123456 delta=0
[DATA] sample=2 raw=123510 delta=54
```

If `DOUT=1` remains in the warning output, check HX711 power, common ground,
and the DOUT connection to GPIO 13.
