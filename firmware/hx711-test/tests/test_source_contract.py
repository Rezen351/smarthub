import pathlib
import unittest


SOURCE = pathlib.Path(__file__).parents[1] / "src" / "main.ino"


class Hx711SourceContractTest(unittest.TestCase):
    def test_diagnostic_pin_mapping_and_raw_protocol(self):
        source = SOURCE.read_text(encoding="utf-8")

        self.assertIn("HX711_DOUT_PIN = 13", source)
        self.assertIn("HX711_SCK_PIN = 14", source)
        self.assertIn("bit < 24", source)
        self.assertIn("value & 0x00800000UL", source)
        self.assertIn("raw=%ld delta=%ld", source)


if __name__ == "__main__":
    unittest.main()
