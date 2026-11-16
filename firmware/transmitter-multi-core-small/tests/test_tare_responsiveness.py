from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class TareResponsivenessContractTest(unittest.TestCase):
    def test_tare_uses_non_blocking_multi_sample_capture(self):
        source = (ROOT / "src" / "Scale.cpp").read_text(encoding="utf-8")
        tare_block = source[source.index("case CMD_TARE:"):source.index("case CMD_ZERO:")]

        self.assertIn("_tareCapturePending", tare_block)
        self.assertIn("_tareSampleCount = 0", tare_block)
        self.assertIn("_tareSampleSum = 0", tare_block)
        self.assertNotIn("hxPoll(_hx, 500)", tare_block)

    def test_tare_applies_after_configured_sample_count(self):
        source = (ROOT / "src" / "Scale.cpp").read_text(encoding="utf-8")

        self.assertIn("_tareSampleSum += (int64_t)raw", source)
        self.assertIn("_tareSampleCount >= HX711_READS", source)
        self.assertIn("_tareCounts = (float)_tareSampleSum / (float)_tareSampleCount", source)
        self.assertIn('"tare applied tareCounts=%.1f counts (calibration kept)"', source)


if __name__ == "__main__":
    unittest.main()
