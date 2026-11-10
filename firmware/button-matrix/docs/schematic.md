# Matrix Button Scanner Schematic

## Pin Assignment

- **Rows (outputs, HIGH idle, LOW active):**
  - Row 1: GPIO 14
  - Row 2: GPIO 18
  - Row 3: GPIO 5
  - Row 4: GPIO 12

- **Columns (inputs with internal `INPUT_PULLUP`):**
  - Col 1: GPIO 21
  - Col 2: GPIO 22
  - Col 3: GPIO 17
  - Col 4: GPIO 16
  - Col 5: GPIO 4

## Wiring

Each switch connects one row to one column. No external power rail is required because columns use the ESP32 internal pull-up resistor (~45 kΩ) to 3.3V.

```
                   (internal 3.3V via INPUT_PULLUP)
                        |
            +-----------+-----------+
            |           |           |
Row 1 -- GPIO 14     |           |
            |           |           |
            +--[SW01]--+--[SW02]--+--[SW03]--+--[SW04]--+--[SW05]--
            |           |          |          |          |
Row 2 -- GPIO 18     |           |           |          |
            |           |           |           |          |
            +--[SW06]--+--[SW07]--+--[SW08]--+--[SW09]--+--[SW10]--
            |           |          |          |          |
Row 3 -- GPIO 5      |           |           |          |
            |           |           |           |          |
            +--[SW11]--+--[SW12]--+--[SW13]--+--[SW14]--+--[SW15]--
            |           |          |          |          |
Row 4 -- GPIO 12     |           |           |          |
            |           |           |           |          |
            +--[SW16]--+--[SW17]--+--[SW18]--+--[SW19]--+--[SW20]--
                           |          |          |          |
                      Col 1      Col 2      Col 3      Col 4      Col 5
                      GPIO 21    GPIO 22    GPIO 17    GPIO 16    GPIO 4
                        |           |          |          |          |
                        +-----------+----------+----------+----------+
                                         |
                                       (internal pull-up to 3.3V)
```

## Notes

- No external power rail is required for the matrix.
