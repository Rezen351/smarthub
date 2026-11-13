"""Checks printable admin cards against the frontend QR and print contract."""

import unittest
from pathlib import Path

from PIL import Image

from generate_admin_idcards import ADMINS, OUTPUT, qr_matrix_from_print_html


class AdminIdCardsTest(unittest.TestCase):
    def test_print_files_and_qr_payloads(self):
        matrices = {}
        for admin in ADMINS:
            stem = f"{admin['code']}_{admin['name'].replace(' ', '_')}"
            html = (OUTPUT / f"{stem}.html").read_text(encoding="utf-8")
            matrices[admin["code"]] = qr_matrix_from_print_html(html)
        self.assertEqual(len({tuple(tuple(r) for r in m) for m in matrices.values()}), len(ADMINS))

        for admin in ADMINS:
            code = admin["code"]
            stem = f"{code}_{admin['name'].replace(' ', '_')}"
            html = (OUTPUT / f"{stem}.html").read_text(encoding="utf-8")
            self.assertIn("size: 80mm 55mm landscape", html)
            self.assertIn(f'<div class="code-chip">{code}</div>', html)
            self.assertIn(admin["name"], html)
            self.assertIn(admin["domicile"], html)
            self.assertIn("data:image/png;base64,", html)
            self.assertIn("SCAN · VERIFY", html)
            self.assertIn("<svg", html)

            image = Image.open(OUTPUT / f"{stem}.png")
            self.assertEqual(image.size, (945, 650))
            matrix = matrices[code]
            module = 242 / (len(matrix) + 8)
            for row, values in enumerate(matrix):
                for col, dark in enumerate(values):
                    x = round(639 + (col + 4.5) * module)
                    y = round(216 + (row + 4.5) * module)
                    pixel = image.getpixel((x, y))
                    self.assertEqual(pixel[0] < 128, dark, (code, row, col))

            self.assertTrue((OUTPUT / f"{stem}.pdf").is_file())

        self.assertTrue((OUTPUT / "admin_idcards_A4_print.pdf").is_file())
        sheet_html = (OUTPUT / "admin_idcards_A4_print.html").read_text(encoding="utf-8")
        self.assertIn("size: A4", sheet_html)
        self.assertEqual(sheet_html.count('<div class="card">'), len(ADMINS))


if __name__ == "__main__":
    unittest.main()
