import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]


class WifiStaticIpContractTest(unittest.TestCase):
    def test_settings_are_persisted_and_exposed(self):
        settings_header = (ROOT / "src" / "Settings.h").read_text(encoding="utf-8")
        settings_source = (ROOT / "src" / "Settings.cpp").read_text(encoding="utf-8")
        portal_source = (ROOT / "src" / "WebPortal.cpp").read_text(encoding="utf-8")

        for field in (
            "wifiUseDhcp",
            "wifiStaticIp",
            "wifiStaticGateway",
            "wifiStaticSubnet",
            "wifiStaticDns",
        ):
            self.assertIn(field, settings_header)
            self.assertIn(field, portal_source)

        for key in ("wifiDhcp", "wifiIp", "wifiGw", "wifiSn", "wifiDns"):
            self.assertIn(f'"{key}"', settings_source)

    def test_ipv4_configuration_precedes_wifi_begin(self):
        source = (ROOT / "src" / "WifiManager.cpp").read_text(encoding="utf-8")
        start_sta = source.index("void WifiManager::startSta")
        configure = source.index("configureStaIpv4(s)", start_sta)
        begin = source.index("WiFi.begin(", start_sta)

        self.assertLess(configure, begin)
        self.assertIn("WiFi.config(localIp, gateway, subnet, dns)", source)

    def test_portal_submits_wifi_static_fields(self):
        html = (ROOT / "data" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "data" / "js" / "app.js").read_text(encoding="utf-8")

        for element_id in (
            "wifiDhcp",
            "wifiStaticIp",
            "wifiStaticGateway",
            "wifiStaticSubnet",
            "wifiStaticDns",
        ):
            self.assertIn(f'id="{element_id}"', html)
            self.assertIn(element_id, script)


if __name__ == "__main__":
    unittest.main()
