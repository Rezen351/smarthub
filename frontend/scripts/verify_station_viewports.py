#!/usr/bin/env python3
"""Verify the shared single-viewport contract for Stations 01–03."""

from pathlib import Path


root = Path(__file__).resolve().parents[1]
pages = {
    "Station 01": root / "src" / "pages" / "WeighingPage.tsx",
    "Station 02": root / "src" / "pages" / "SortingPage.tsx",
    "Station 03": root / "src" / "pages" / "PackagingPage.tsx",
}

for station, path in pages.items():
    source = path.read_text(encoding="utf-8")
    for class_name in (
        "station-workflow",
        "station-step",
        "station-focus-main",
        "station-page",
        "station-quick-stats",
        "station-stepper-shell",
    ):
        if class_name not in source:
            raise SystemExit(f"{station} is missing {class_name}")

css = (root / "src" / "styles" / "index.css").read_text(encoding="utf-8")
for rule in (
    "Station 01–03 Single-Viewport Console",
    ".station-page > :first-child",
    ".station-quick-stats",
    ".station-focus-main",
    ".station-grade-tabs",
    ".station-mode-grid",
    ".station-preview-grid",
    "max-height: 820px",
):
    if rule not in css:
        raise SystemExit(f"Responsive station rule is missing: {rule}")

print("Station 01–03 single-viewport contract verified.")
