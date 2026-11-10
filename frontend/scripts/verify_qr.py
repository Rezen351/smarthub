"""
QR encoder verification: encodes sample payloads with frontend/src/lib/qrEncoder.ts
and decodes them with OpenCV QRCodeDetector. Exit code 1 on any mismatch.

Usage: python3 frontend/scripts/verify_qr.py
"""
import json
import pathlib
import subprocess
import sys

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SAMPLES = [
    "FMR-001",
    "FMR-1234",
    "WRG-20261027-001",
    "PLT-GRD-A-20261027-0001",
    "PCH-20261010-001",
    "https://id.enyx.io/01/08901234567890/21/WRG-20261027-001",
    "https://smarthub.enyx.io/traceability/PCH-20261027-000123?lot=PLT-GRD-B-20261027-0042&grade=B&src=FMR-0001",
    "A" * 150,
    "B" * 210,
]

node_script = (
    "import { encodeQr } from './src/lib/qrEncoder.ts';"
    f"const s = {json.dumps(SAMPLES)};"
    "console.log(JSON.stringify(s.map((t) => encodeQr(t).map((r) => r.map((c) => (c ? 1 : 0))))));"
)
out = subprocess.run(
    ["node", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", node_script],
    cwd=ROOT, capture_output=True, text=True, check=True,
).stdout
matrices = json.loads(out)

detector = cv2.QRCodeDetector()
failed = 0
for text, matrix in zip(SAMPLES, matrices):
    m = np.array(matrix, dtype=np.uint8)
    img = np.where(m == 1, 0, 255).astype(np.uint8)
    img = np.pad(img, 4, constant_values=255)
    img = cv2.resize(img, None, fx=10, fy=10, interpolation=cv2.INTER_NEAREST)
    decoded, _, _ = detector.detectAndDecode(img)
    ok = decoded == text
    failed += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  v{(len(matrix) - 17) // 4:<2} {text[:60]!r} -> {decoded[:60]!r}")

print(f"\n{len(SAMPLES) - failed}/{len(SAMPLES)} passed")
sys.exit(1 if failed else 0)
