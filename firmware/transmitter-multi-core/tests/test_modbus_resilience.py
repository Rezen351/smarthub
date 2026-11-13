import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]


class ModbusResilienceContractTest(unittest.TestCase):
    def test_modbus_stack_is_serviced_every_network_loop(self):
        source = (ROOT / "src" / "main.ino").read_text(encoding="utf-8")
        self.assertIn("gModbus.loop();", source)
        self.assertNotIn("if ((millis() - lastModbus) >= MODBUS_POLL_MS)", source)

    def test_same_transport_does_not_restart_server(self):
        source = (ROOT / "src" / "ModbusServer.cpp").read_text(encoding="utf-8")
        self.assertIn("if (_started && mode == _transportMode)", source)
        self.assertIn("transport mode unchanged; server remains active", source)

    def test_wifi_reconnect_uses_computed_backoff(self):
        source = (ROOT / "src" / "WifiManager.cpp").read_text(encoding="utf-8")
        self.assertIn("millis() - _wifiLastReconnectMs) < _wifiReconnectDelayMs", source)

    def test_client_presence_uses_connection_callbacks(self):
        source = (ROOT / "src" / "ModbusServer.cpp").read_text(encoding="utf-8")
        self.assertIn("_mb.onConnect", source)
        self.assertIn("_mb.onDisconnect", source)
        self.assertIn("return _wifiClientCount > 0;", source)


if __name__ == "__main__":
    unittest.main()
