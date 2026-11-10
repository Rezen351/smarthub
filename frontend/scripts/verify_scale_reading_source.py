#!/usr/bin/env python3
"""Verify the live scale source selector contract without external packages."""

from pathlib import Path


component = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "components"
    / "operator"
    / "ScaleWeightInput.tsx"
).read_text(encoding="utf-8")

required_fragments = {
    "stable API mapping": "telemetry.stableWeightKg ?? liveWeight",
    "instantaneous API mapping": "telemetry.weightKg ?? telemetry.weight ?? 0",
    "settings storage": "localStorage.getItem(SETTINGS_STORAGE_KEY)",
    "station setting mapping": "settings?.[stationKey]?.weightRegister",
    "stable register mapping": "=== '40003' ? 'stable' : 'instantaneous'",
    "selected reading": "readingSource === 'stable' ? stableReading : instantaneousReading",
}

missing = [name for name, fragment in required_fragments.items() if fragment not in component]
if missing:
    raise SystemExit("Missing scale source contract: " + ", ".join(missing))

for removed_control in ("Reading Source", "Stable (40003–40004)", "Instantaneous (40001–40002)"):
    if removed_control in component:
        raise SystemExit(f"Step control still present: {removed_control}")

print("Scale reading source contract verified.")
