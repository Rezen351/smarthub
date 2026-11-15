from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SmallScalePrecisionContractTest(unittest.TestCase):
    def test_config_sets_2g_division_and_anti_drift_parameters(self):
        config = (ROOT / "src/config.h").read_text(encoding="utf-8")

        self.assertIn("#define SCALE_DIVISION_G            2.0f", config)
        self.assertIn("#define SCALE_DEADBAND_G            3.0f", config)
        self.assertIn("#define SCALE_BREAKOUT_THRESHOLD_G  15.0f", config)
        self.assertIn("#define SCALE_STABILITY_RANGE_G 4.0f", config)
        self.assertIn("#define SCALE_ZERO_LAMP_BAND_G 2.0f", config)
        self.assertIn("#define SCALE_AZT_BAND_G            4.0f", config)
        self.assertIn("#define SCALE_AZT_RATE_G_PER_S      0.5f", config)

    def test_gn6932_display_renders_three_decimal_places(self):
        display_header = (ROOT / "src/Gn6932Display.h").read_text(encoding="utf-8")
        display_cpp = (ROOT / "src/Gn6932Display.cpp").read_text(encoding="utf-8")

        self.assertIn("static constexpr uint8_t SECTION1_DP_GRID = 1;", display_header)
        self.assertIn("uint32_t milliWeight = (uint32_t)(absWeight * 1000.0f + 0.5f);", display_cpp)
        self.assertIn("if (milliWeight > 99999) milliWeight = 99999;", display_cpp)
        self.assertIn('snprintf(text, sizeof(text), "%2lu%03lu",', display_cpp)


if __name__ == "__main__":
    unittest.main()

