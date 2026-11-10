#!/usr/bin/env python3
"""Verify admin dashboard and reports use operational data without sample records."""

from pathlib import Path


root = Path(__file__).resolve().parents[1]
admin = (root / "src" / "pages" / "AdminDashboardHome.tsx").read_text(encoding="utf-8")
reports = (root / "src" / "pages" / "ReportsPage.tsx").read_text(encoding="utf-8")

for required in (
    "usePackhouseStore",
    "Presentation Mode",
    "requestFullscreen",
    "PACKHOUSE OPERATIONS",
    "Station 01 through final dispatch",
    "bufferWarings.slice(0, 2)",
    "sortedBatches.slice(0, 2)",
    "finishedStock.slice(0, 2)",
    "deliveries.slice(0, 2)",
):
    if required not in admin:
        raise SystemExit(f"Admin dashboard contract is missing: {required}")

for forbidden in ("Math.random", "3000", "mock", "dummy"):
    if forbidden in admin.lower():
        raise SystemExit(f"Admin dashboard contains non-operational data marker: {forbidden}")

for required in (
    "Transaction Ledger",
    "DataTable",
    "No transactions recorded.",
    "bufferWarings.map",
    "sortedBatches.map",
    "finishedStock.map",
    "deliveries.map",
):
    if required not in reports:
        raise SystemExit(f"Reports transaction contract is missing: {required}")

if "useState<number>(1)" in reports or "/ 3000" in reports:
    raise SystemExit("Reports still contains a seeded count or assumed warehouse capacity")

print("Admin presentation and reporting contracts verified.")
