#!/usr/bin/env python3
"""Verify that pallet registration is grouped under Settings."""

from pathlib import Path


root = Path(__file__).resolve().parents[1]
app = (root / "src" / "App.tsx").read_text(encoding="utf-8")
layout = (root / "src" / "components" / "layout" / "DashboardLayout.tsx").read_text(encoding="utf-8")
settings = (root / "src" / "pages" / "SettingsPage.tsx").read_text(encoding="utf-8")
pallets = (root / "src" / "pages" / "PalletsPage.tsx").read_text(encoding="utf-8")

if "{ label: 'Pallet Registry', path: '/dashboard/pallets'" in layout:
    raise SystemExit("Pallet Registry must not remain a primary sidebar item")

required_app_contracts = (
    'path="pallets"',
    'to="/dashboard/settings?section=pallets"',
)
for contract in required_app_contracts:
    if contract not in app:
        raise SystemExit(f"Missing legacy pallet route contract: {contract}")

required_settings_contracts = (
    "label: 'Devices'",
    "label: 'Pallet Registry'",
    'role="tablist"',
    'role="tabpanel"',
    '<PalletsPage embedded />',
    "statusRegister: '40011'",
    'label="Weight Start Register"',
    'label="Status Register"',
    'weightRegister: Number(form.intake.weightRegister)',
    'statusRegister: Number(form.intake.statusRegister)',
    'configuredPrinters.map',
)
for contract in required_settings_contracts:
    if contract not in settings:
        raise SystemExit(f"Missing Settings section contract: {contract}")

if "Station overview" in settings or "No thermal printer" in settings:
    raise SystemExit("Device Settings must open directly on the configuration form")

if 'id="intake-ip"' not in settings or 'id="pkg-ip"' not in settings:
    raise SystemExit("Device Settings configuration fields are missing")

if "embedded?: boolean" not in pallets:
    raise SystemExit("Pallet Registry must support the embedded Settings layout")

print("Settings device and pallet sections verified.")
