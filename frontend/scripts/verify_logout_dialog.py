#!/usr/bin/env python3
"""Verify logout closes navigation layers before opening the confirmation dialog."""

from pathlib import Path
import re


layout = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "components"
    / "layout"
    / "DashboardLayout.tsx"
).read_text(encoding="utf-8")
dialog = (
    Path(__file__).resolve().parents[1] / "src" / "components" / "ui" / "dialog.tsx"
).read_text(encoding="utf-8")

handler = re.search(
    r"const requestLogout = \(\) => \{(?P<body>.*?)\n  \}",
    layout,
    re.DOTALL,
)
if handler is None:
    raise SystemExit("Dashboard logout request handler is missing")

body = handler.group("body")
required_actions = (
    "setMenuOpen(false)",
    "setUserMenuOpen(false)",
    "setLogoutOpen(true)",
)
for action in required_actions:
    if action not in body:
        raise SystemExit(f"Logout request handler is missing: {action}")

if layout.count("onClick={requestLogout}") != 2:
    raise SystemExit("Both sidebar and account-menu logout buttons must use requestLogout")

if dialog.count("z-[100]") != 2:
    raise SystemExit("Dialog overlay and content must render above navigation layers")

print("Logout dialog navigation-layer contract verified.")
