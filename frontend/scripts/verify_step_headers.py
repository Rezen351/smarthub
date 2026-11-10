#!/usr/bin/env python3
"""Verify station workflow headers use one progress line and one concise title."""

from pathlib import Path
import re


root = Path(__file__).resolve().parents[1]
expected = {
    "WeighingPage.tsx": (
        ("Step 1 of 3", "Scan Farmer Card"),
        ("Step 2 of 3", "Weigh Harvest"),
        ("Step 3 of 3", "Approve & Print"),
    ),
    "SortingPage.tsx": (
        ("Step 1 of 4", "Scan Waring"),
        ("Step 2 of 4", "Size & Wash"),
        ("Step 3 of 4", "Weigh Grades"),
        ("Step 4 of 4", "Review & Save"),
    ),
    "PackagingPage.tsx": (
        ("Step 1 of 3", "Scan Pallet & Select Package"),
        ("Step 2 of 3", "Weigh Package"),
        ("Step 3 of 3", "Print Label & Store"),
    ),
}

for filename, headers in expected.items():
    source = (root / "src" / "pages" / filename).read_text(encoding="utf-8")
    if re.search(r"Step \d+ of \d+\s+·", source):
        raise SystemExit(f"{filename} still includes a duplicate title in a progress line")
    for progress, title in headers:
        if progress not in source or title not in source:
            raise SystemExit(f"{filename} is missing header: {progress} / {title}")

station_shells = {
    "WeighingPage.tsx": "Step {activeStep} of 3",
    "SortingPage.tsx": "Step {activeStep} of 4",
    "PackagingPage.tsx": "Step {activeStep} of 3",
}
for filename, dynamic_progress in station_shells.items():
    source = (root / "src" / "pages" / filename).read_text(encoding="utf-8")
    if dynamic_progress in source:
        raise SystemExit(f"{filename} stepper header duplicates the active step count")
    if source.count("onClick={enterFocusMode}") != 1:
        raise SystemExit(f"{filename} must expose Focus Mode only from the stepper card")
    if "Open Focus Mode" in source:
        raise SystemExit(f"{filename} must use the concise Focus Mode label")

print("Station workflow step headers verified.")
