import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).parents[1] / "src" / "WifiManager.cpp"


class WifiStartupOrderTest(unittest.TestCase):
    def test_tx_power_is_set_after_soft_ap_starts(self):
        source = SOURCE_PATH.read_text(encoding="utf-8")

        soft_ap_call = source.index("bool apOk = WiFi.softAP(")
        tx_power_call = source.index("WiFi.setTxPower(WIFI_POWER_11dBm)")

        self.assertGreater(tx_power_call, soft_ap_call)
        self.assertIn("if (apOk) {", source[soft_ap_call:tx_power_call])


if __name__ == "__main__":
    unittest.main()
