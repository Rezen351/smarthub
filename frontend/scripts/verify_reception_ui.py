#!/usr/bin/env python3
"""Verify the Reception weighing step does not render the removed live preview."""

from pathlib import Path


page = (
    Path(__file__).resolve().parents[1] / "src" / "pages" / "WeighingPage.tsx"
).read_text(encoding="utf-8")

removed_fragments = (
    "Live Waring QR Preview",
    "Real-time Waring Label Preview",
)

present = [fragment for fragment in removed_fragments if fragment in page]
if present:
    raise SystemExit("Removed Reception preview remains: " + ", ".join(present))

if page.count("screenFit") != 2:
    raise SystemExit("Reception Step 3 must use two screen-fitted label previews")

print("Reception preview layout verified.")
