#!/usr/bin/env python3
"""Generate administrator ID cards from the frontend print design."""

import base64
import io
import json
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "admin"
LOGO = ROOT / "frontend" / "public" / "Smart Geulis.png"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
ADMINS = (
    {"name": "Rizal Fahreza", "role": "ADMIN", "code": "ADM-002", "domicile": "Desa Cigedug, Kec. Cigedug"},
    {"name": "Fazrul Falah", "role": "ADMIN", "code": "ADM-003", "domicile": "Desa Cigedug, Kec. Cigedug"},
)


def frontend_print_html(admins):
    """Call printIdCard in the frontend component and capture its exact HTML."""
    esbuild = ROOT / "frontend" / "node_modules" / ".bin" / "esbuild"
    source = ROOT / "frontend" / "src" / "components" / "shared" / "IdCard.tsx"
    with tempfile.TemporaryDirectory(prefix="smarthub_admin_card_") as temp:
        bundle = Path(temp) / "idcard.cjs"
        subprocess.run(
            [str(esbuild), str(source), "--bundle", "--platform=node", "--format=cjs", f"--outfile={bundle}", "--log-level=error"],
            check=True,
        )
        node = r"""
const fs = require('fs')
const { printIdCard } = require(process.argv[1])
const admins = JSON.parse(fs.readFileSync(0, 'utf8'))
let html = ''
global.window = {
  location: { origin: 'https://local.invalid' },
  open: () => ({ document: { open() {}, write(value) { html = value }, close() {} } }),
}
const result = admins.map((admin) => {
  printIdCard(admin)
  return html
})
process.stdout.write(JSON.stringify(result))
"""
        result = subprocess.run(
            ["node", "-e", node, str(bundle)],
            input=json.dumps(admins), text=True, capture_output=True, check=True,
        )
    logo = Image.open(LOGO).convert("RGBA")
    logo.thumbnail((320, 320), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    logo.save(buffer, "PNG", optimize=True)
    logo_uri = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    return [html.replace("https://local.invalid/Smart%20Geulis.png", logo_uri) for html in json.loads(result.stdout)]


def qr_matrix_from_print_html(html):
    """Read the QR emitted by frontend printIdCard (two-module quiet zone)."""
    size = int(re.search(r'viewBox="0 0 (\d+) \d+"', html).group(1)) - 4
    path = re.search(r'<path d="([^"]+)" fill="#000000"', html).group(1)
    matrix = [[False for _ in range(size)] for _ in range(size)]
    for x, y in re.findall(r'M(\d+) (\d+)h1v1h-1z', path):
        matrix[int(y) - 2][int(x) - 2] = True
    return matrix


def render_preview(admin, matrix, logo):
    """Rasterize the visible frontend card fields at 300 DPI for PDF output."""
    width, height = 945, 650
    card = Image.new("RGBA", (width, height), "white")
    draw = ImageDraw.Draw(card)
    label = ImageFont.truetype(MONO_BOLD, 21)
    name_font = ImageFont.truetype(BOLD, 40)
    address_font = ImageFont.truetype(BOLD, 28)
    code_font = ImageFont.truetype(MONO_BOLD, 32)
    brand_font = ImageFont.truetype(BOLD, 36)
    sub_font = ImageFont.truetype(MONO_BOLD, 22)
    footer_font = ImageFont.truetype(MONO_BOLD, 22)
    badge_font = ImageFont.truetype(MONO_BOLD, 22)

    draw.rectangle((0, 0, width, 112), fill="#0a0a0a")
    mark = logo.copy()
    mark.thumbnail((66, 66), Image.Resampling.LANCZOS)
    card.alpha_composite(mark, (37, 22))
    draw.text((122, 26), "SmartGeulis", font=brand_font, fill="white")
    draw.text((123, 73), "TRACEABILITY SYSTEM", font=sub_font, fill="#e4e4e7")
    draw.rectangle((675, 37, 902, 78), fill="#f4f4f5", outline="#e4e4e7", width=2)
    draw.ellipse((691, 54, 702, 65), fill="#22c55e")
    draw.text((711, 44), "ADMINISTRATOR", font=badge_font, fill="#18181b")

    watermark = logo.resize((420, 420), Image.Resampling.LANCZOS)
    watermark.putalpha(watermark.getchannel("A").point(lambda alpha: round(alpha * 0.08)))
    card.alpha_composite(watermark, ((width - 420) // 2, 140))

    draw.text((42, 220), "FULL NAME", font=label, fill="#555555")
    draw.text((42, 250), admin["name"], font=name_font, fill="#171717")
    draw.text((42, 325), "IDENTIFICATION CODE", font=label, fill="#555555")
    draw.rectangle((42, 356, 224, 404), fill="#f4f4f5", outline="#e4e4e7", width=2)
    draw.text((55, 361), admin["code"], font=code_font, fill="#18181b")
    draw.text((42, 442), "DOMICILE / FACILITY", font=label, fill="#555555")
    draw.text((42, 476), admin["domicile"], font=address_font, fill="#222222")

    qr_x, qr_y, qr_size = 620, 202, 280
    draw.rectangle((qr_x, qr_y, qr_x + qr_size, qr_y + qr_size + 33), fill="white", outline="#eaeaea", width=2)
    quiet_zone = 4
    module = 242 / (len(matrix) + quiet_zone * 2)
    start_x, start_y = qr_x + 19, qr_y + 14
    for row, values in enumerate(matrix):
        for col, dark in enumerate(values):
            if dark:
                x0 = round(start_x + (col + quiet_zone) * module)
                y0 = round(start_y + (row + quiet_zone) * module)
                x1 = round(start_x + (col + quiet_zone + 1) * module)
                y1 = round(start_y + (row + quiet_zone + 1) * module)
                draw.rectangle((x0, y0, x1, y1), fill="black")
    draw.text((657, 471), "SCAN · VERIFY", font=ImageFont.truetype(MONO_BOLD, 20), fill="#333333")

    draw.rectangle((0, 588, width, height), fill="#fafafa")
    draw.line((0, 588, width, 588), fill="#eaeaea", width=2)
    draw.rectangle((42, 618, 50, 626), fill="#18181b")
    draw.text((61, 610), "AUTHENTICATED PASS", font=footer_font, fill="#171717")
    draw.text((750, 610), "SMARTGEULIS", font=footer_font, fill="#171717")
    draw.line((0, 0, 29, 0), fill="#18181b", width=4)
    draw.line((0, 0, 0, 29), fill="#18181b", width=4)
    draw.line((width - 29, height - 1, width - 1, height - 1), fill="#18181b", width=4)
    draw.line((width - 1, height - 29, width - 1, height - 1), fill="#18181b", width=4)
    draw.rectangle((0, 0, width - 1, height - 1), outline="#eaeaea", width=2)
    return card.convert("RGB")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    html_cards = frontend_print_html(ADMINS)
    logo = Image.open(LOGO).convert("RGBA")
    images = []
    for admin, html in zip(ADMINS, html_cards):
        code = admin["code"]
        assert f'<div class="code-chip">{code}</div>' in html
        assert "<svg" in html and "SCAN · VERIFY" in html
        name = f"{code}_{admin['name'].replace(' ', '_')}"
        (OUTPUT / f"{name}.html").write_text(html, encoding="utf-8")
        image = render_preview(admin, qr_matrix_from_print_html(html), logo)
        image.save(OUTPUT / f"{name}.png", "PNG", dpi=(300, 300))
        image.save(OUTPUT / f"{name}.pdf", "PDF", resolution=300)
        images.append(image)

    css = html_cards[0].split("<style>", 1)[1].split("</style>", 1)[0]
    bodies = [html.split("<body>", 1)[1].split("</body>", 1)[0] for html in html_cards]
    sheet_css = "@page { size: A4; margin: 12mm; } body { width: auto; height: auto; display: flex; flex-direction: column; justify-content: flex-start; gap: 12mm; padding-top: 8mm; }"
    sheet_html = f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>SmartGeulis Administrator ID Cards</title><style>{css}{sheet_css}</style></head><body>{"".join(bodies)}</body></html>'
    (OUTPUT / "admin_idcards_A4_print.html").write_text(sheet_html, encoding="utf-8")

    sheet = Image.new("RGB", (2480, 3508), "white")
    draw = ImageDraw.Draw(sheet)
    for index, image in enumerate(images):
        x, y = 768, 450 + index * 850
        sheet.paste(image, (x, y))
        draw.rectangle((x - 2, y - 2, x + 946, y + 651), outline="#666666", width=2)
    sheet.save(OUTPUT / "admin_idcards_A4_print.pdf", "PDF", resolution=300)
    print(f"Generated {len(images)} administrator cards from the frontend layout in {OUTPUT}")


if __name__ == "__main__":
    main()
