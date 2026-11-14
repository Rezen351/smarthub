from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CalibrationHistoryContractTest(unittest.TestCase):
    def test_portal_uses_device_calibration_history_endpoints(self):
        app = (ROOT / "data/js/app.js").read_text(encoding="utf-8")

        self.assertIn("/api/calibration/capture?kg=", app)
        self.assertIn("/api/calibration/delete?index=", app)
        self.assertIn("apiCall('/api/calibration/start', { method: 'POST' })", app)
        self.assertIn("Array.isArray(data.data.points)", app)

    def test_calibration_point_mutations_are_persisted_to_nvs(self):
        portal = (ROOT / "src/WebPortal.cpp").read_text(encoding="utf-8")
        shared_header = (ROOT / "src/SharedState.h").read_text(encoding="utf-8")

        self.assertIn('"/api/calibration/delete"', portal)
        self.assertIn("persistCalibrationPoints();", portal)
        self.assertIn("_settings->clearCalibrationPoints();", portal)
        self.assertIn("bool removeCalibrationPoint(uint8_t index);", shared_header)

    def test_device_response_remains_authoritative_when_history_is_empty(self):
        app = (ROOT / "data/js/app.js").read_text(encoding="utf-8")

        authoritative_condition = (
            "if (data && data.ok && data.data && Array.isArray(data.data.points))"
        )
        self.assertIn(authoritative_condition, app)
        self.assertNotIn("data.data.points.length > 0", app)


if __name__ == "__main__":
    unittest.main()
