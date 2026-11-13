#!/usr/bin/env python3
"""
generate_farmer_idcards.py
Generates official SmartGeulis Farmer ID Cards (PNG, PDF, A4 Sheets, and HTML Gallery)
for all registered farmers in the SmartHub system.
"""

import os
import sys
import json
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_FARMER_DIR = os.path.join(ROOT_DIR, "docs", "farmer")
CARDS_PNG_DIR = os.path.join(DOCS_FARMER_DIR, "cards_png")
CARDS_PDF_DIR = os.path.join(DOCS_FARMER_DIR, "cards_pdf")
LOGO_PATH = os.path.join(ROOT_DIR, "frontend", "public", "Smart Geulis.png")

# Font paths
FONT_BOLD_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REGULAR_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_MONO_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_MONO_REG_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

def get_farmers_data():
    """Fetch all farmers from PostgreSQL container or fallback json"""
    try:
        cmd = [
            "docker", "exec", "enyx-postgres", "psql", "-U", "enyx", "-d", "enyx_smart_hub", "-t", "-A", "-c",
            """
            SELECT json_agg(t) FROM (
              SELECT 
                f.code,
                f.name,
                COALESCE(u.email, '') as email,
                COALESCE(f.phone, '') as phone,
                COALESCE(f.village, '') as village,
                COALESCE(f.district, '') as district,
                COALESCE(f.address, '') as address,
                COALESCE(f."landStatus", '') as land_status,
                COALESCE(f."landArea", '') as land_area,
                COALESCE(f."landAreaUnit", '') as land_area_unit,
                COALESCE(f."joinYear", '') as join_year,
                COALESCE(f."averageProduction", '') as average_production,
                f."createdAt" as created_at
              FROM farmers f
              LEFT JOIN users u ON f."userId" = u.id
              ORDER BY f.code
            ) t;
            """
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout.strip())
        if data:
            return data
    except Exception as e:
        print(f"Warning: could not query postgres ({e}), checking /tmp/farmers_data.json")
    
    with open("/tmp/farmers_data.json") as f:
        return json.load(f)

def generate_qr_matrices(farmer_codes):
    """Use node with frontend/src/lib/qrEncoder to generate QR matrices"""
    ts_script = os.path.join(ROOT_DIR, "frontend", "src", "lib", "qrEncoder.ts")
    out_dir = "/tmp/qr"
    os.makedirs(out_dir, exist_ok=True)
    compiled_js = os.path.join(out_dir, "qrEncoder.js")
    
    # Compile with frontend tsc
    tsc_path = os.path.join(ROOT_DIR, "frontend", "node_modules", ".bin", "tsc")
    subprocess.run([tsc_path, ts_script, "--outDir", out_dir, "--target", "es2020", "--module", "esnext"], check=True)
    
    node_cmd = f"""
    import('{compiled_js}').then(({{ encodeQr }}) => {{
      const codes = {json.dumps(farmer_codes)};
      const res = {{}};
      for (const c of codes) {{
        res[c] = encodeQr(c);
      }}
      console.log(JSON.stringify(res));
    }});
    """
    res = subprocess.run(["node", "--input-type=module", "-e", node_cmd], capture_output=True, text=True, check=True)
    return json.loads(res.stdout.strip())

def render_id_card_image(data, qr_matrix, logo_img):
    """Renders single 945 x 650 px 300 DPI card matching IdCard.tsx"""
    width = 945
    height = 650
    
    card = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(card)
    
    font_bold = ImageFont.truetype(FONT_BOLD_PATH, 36)
    font_sub_bold = ImageFont.truetype(FONT_BOLD_PATH, 30)
    font_regular = ImageFont.truetype(FONT_REGULAR_PATH, 22)
    font_mono_bold = ImageFont.truetype(FONT_MONO_BOLD_PATH, 18)
    font_mono_chip = ImageFont.truetype(FONT_MONO_BOLD_PATH, 28)
    font_mono_small = ImageFont.truetype(FONT_MONO_BOLD_PATH, 15)
    font_mono_title = ImageFont.truetype(FONT_MONO_BOLD_PATH, 20)
    
    # 1. Body Watermark Logo (Opacity 0.08)
    if logo_img:
        wm_size = 360
        wm = logo_img.resize((wm_size, wm_size), Image.Resampling.LANCZOS)
        r, g, b, a = wm.split()
        a = a.point(lambda p: int(p * 0.08))
        wm.putalpha(a)
        wm_x = (width - wm_size) // 2
        wm_y = 130 + (445 - wm_size) // 2
        card.alpha_composite(wm, (wm_x, wm_y))
        
    # 2. Header Band (#15803d)
    header_h = 130
    draw.rectangle([0, 0, width, header_h], fill="#15803d")
    
    # Header Logo
    if logo_img:
        logo_thumb = logo_img.resize((68, 68), Image.Resampling.LANCZOS)
        card.alpha_composite(logo_thumb, (45, 31))
        
    # Header Typography
    draw.text((128, 38), "SmartGeulis", fill="#ffffff", font=font_bold)
    draw.text((128, 82), "TRACEABILITY SYSTEM", fill="#86efac", font=font_mono_title)
    
    # Role Pill Badge (Top Right)
    role_text = "FARMER"
    bbox = draw.textbbox((0, 0), role_text, font=font_mono_bold)
    text_w = bbox[2] - bbox[0]
    pill_w = text_w + 50
    pill_h = 44
    pill_x = width - pill_w - 45
    pill_y = 43
    draw.rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], fill="#f0fdf4", outline="#86efac", width=2)
    
    dot_r = 5
    dot_cx = pill_x + 18
    dot_cy = pill_y + pill_h // 2
    draw.ellipse([dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r], fill="#22c55e")
    draw.text((pill_x + 32, pill_y + 11), role_text, fill="#14532d", font=font_mono_bold)
    
    # 3. Left Column (Details)
    left_x = 45
    
    # FULL NAME
    draw.text((left_x, 155), "FULL NAME", fill="#666666", font=font_mono_small)
    name = clean_display_name(data.get("name", "Farmer Name"))
    max_name_w = 480
    if draw.textbbox((0, 0), name, font=font_sub_bold)[2] > max_name_w:
        while len(name) > 0 and (draw.textbbox((0, 0), name + "...", font=font_sub_bold)[2] > max_name_w):
            name = name[:-1]
        name += "..."
    draw.text((left_x, 180), name, fill="#171717", font=font_sub_bold)
    
    # IDENTIFICATION CODE
    draw.text((left_x, 240), "IDENTIFICATION CODE", fill="#666666", font=font_mono_small)
    code = data.get("code", "FMR-001")
    c_bbox = draw.textbbox((0, 0), code, font=font_mono_chip)
    chip_w = (c_bbox[2] - c_bbox[0]) + 30
    chip_h = 44
    chip_y = 265
    draw.rectangle([left_x, chip_y, left_x + chip_w, chip_y + chip_h], fill="#f0fdf4", outline="#86efac", width=2)
    draw.text((left_x + 15, chip_y + 6), code, fill="#14532d", font=font_mono_chip)
    
    # DOMICILE / FACILITY
    draw.text((left_x, 335), "DOMICILE / FACILITY", fill="#666666", font=font_mono_small)
    domicile = data.get("address", "") or data.get("village", "") or "Garut, Jawa Barat"
    if draw.textbbox((0, 0), domicile, font=font_regular)[2] > max_name_w:
        words = domicile.split()
        line1, line2 = "", ""
        for w in words:
            if draw.textbbox((0, 0), line1 + " " + w, font=font_regular)[2] < max_name_w:
                line1 += (" " if line1 else "") + w
            else:
                line2 += (" " if line2 else "") + w
        draw.text((left_x, 360), line1, fill="#222222", font=font_regular)
        draw.text((left_x, 390), line2, fill="#222222", font=font_regular)
    else:
        draw.text((left_x, 360), domicile, fill="#222222", font=font_regular)
        
    # ROLE / POSITION
    draw.text((left_x, 445), "ROLE / POSITION", fill="#666666", font=font_mono_small)
    draw.text((left_x, 470), "Registered Farmer", fill="#171717", font=font_regular)
    
    # 4. QR Frame (Right Column)
    qr_x = 585
    qr_y = 155
    qr_box_size = 315
    draw.rectangle([qr_x, qr_y, qr_x + qr_box_size, qr_y + qr_box_size], fill="#ffffff", outline="#eaeaea", width=2)
    
    # Modules
    matrix_dim = len(qr_matrix)
    quiet_zone = 2
    total_dim = matrix_dim + quiet_zone * 2
    module_size = (qr_box_size - 40) / total_dim
    qr_start_x = qr_x + 20 + quiet_zone * module_size
    qr_start_y = qr_y + 15 + quiet_zone * module_size
    
    for r in range(matrix_dim):
        for c in range(matrix_dim):
            if qr_matrix[r][c]:
                mx0 = round(qr_start_x + c * module_size)
                my0 = round(qr_start_y + r * module_size)
                mx1 = round(mx0 + module_size)
                my1 = round(my0 + module_size)
                draw.rectangle([mx0, my0, mx1, my1], fill="#000000")
                
    caption = "SCAN · VERIFY ACCESS"
    cap_bbox = draw.textbbox((0, 0), caption, font=font_mono_small)
    cap_w = cap_bbox[2] - cap_bbox[0]
    draw.text((qr_x + (qr_box_size - cap_w) // 2, qr_y + qr_box_size - 25), caption, fill="#333333", font=font_mono_small)
    
    # 5. Footer Band (#fafafa)
    footer_y = 575
    draw.rectangle([0, footer_y, width, height], fill="#fafafa")
    draw.line([0, footer_y, width, footer_y], fill="#eaeaea", width=2)
    
    draw.rectangle([45, footer_y + 30, 54, footer_y + 39], fill="#16a34a")
    draw.text((64, footer_y + 24), "AUTHENTICATED PASS", fill="#171717", font=font_mono_bold)
    
    sg_bbox = draw.textbbox((0, 0), "SMARTGEULIS", font=font_mono_bold)
    sg_w = sg_bbox[2] - sg_bbox[0]
    draw.text((width - sg_w - 45, footer_y + 24), "SMARTGEULIS", fill="#171717", font=font_mono_bold)
    
    # 6. Signature Landing Page Corner Brackets
    bracket_len = 32
    bracket_thick = 4
    draw.line([0, 0, bracket_len, 0], fill="#16a34a", width=bracket_thick)
    draw.line([0, 0, 0, bracket_len], fill="#16a34a", width=bracket_thick)
    draw.line([width - bracket_len, height - 1, width, height - 1], fill="#16a34a", width=bracket_thick)
    draw.line([width - 1, height - bracket_len, width - 1, height], fill="#16a34a", width=bracket_thick)
    
    # 7. Outer Hairline Border
    draw.rectangle([0, 0, width - 1, height - 1], outline="#eaeaea", width=2)
    
    return card.convert("RGB")

def create_a4_sheet(page_num, total_pages, card_images, font_regular, font_bold, font_mono):
    """
    Creates an A4 sheet (2480 x 3508 px @ 300 DPI) containing up to 8 cards (2x4)
    with precise cutting guidelines and sheet header.
    """
    sheet_w = 2480
    sheet_h = 3508
    sheet = Image.new("RGB", (sheet_w, sheet_h), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    
    # Sheet Header
    draw.rectangle([0, 0, sheet_w, 140], fill="#f8fafc")
    draw.line([0, 140, sheet_w, 140], fill="#e2e8f0", width=2)
    
    # Header Text
    draw.text((100, 35), "SMARTGEULIS TRACEABILITY SYSTEM · OFFICIAL FARMER ID CARD SHEET", fill="#0f172a", font=font_bold)
    draw.text((100, 80), f"Sheet {page_num} of {total_pages} · Standard ID-1 Card Size (80 mm x 55 mm) · 300 DPI Print Quality", fill="#64748b", font=font_mono)
    draw.text((sheet_w - 460, 55), "CUT ALONG GUIDES", fill="#16a34a", font=font_mono)
    
    # Layout Coordinates
    card_w = 945
    card_h = 650
    
    left_m = 140
    col_gap = 310
    top_m = 220
    row_gap = 180
    
    for idx, card_img in enumerate(card_images):
        col = idx % 2
        row = idx // 2
        
        x = left_m + col * (card_w + col_gap)
        y = top_m + row * (card_h + row_gap)
        
        # Paste Card
        sheet.paste(card_img, (x, y))
        
        # Draw Cutting Guides / Crop Marks around the card
        cm_len = 20
        cm_dist = 6
        cm_color = "#94a3b8"
        
        # Top-Left Crop Mark
        draw.line([x - cm_dist - cm_len, y, x - cm_dist, y], fill=cm_color, width=1)
        draw.line([x, y - cm_dist - cm_len, x, y - cm_dist], fill=cm_color, width=1)
        
        # Top-Right Crop Mark
        draw.line([x + card_w + cm_dist, y, x + card_w + cm_dist + cm_len, y], fill=cm_color, width=1)
        draw.line([x + card_w, y - cm_dist - cm_len, x + card_w, y - cm_dist], fill=cm_color, width=1)
        
        # Bottom-Left Crop Mark
        draw.line([x - cm_dist - cm_len, y + card_h, x - cm_dist, y + card_h], fill=cm_color, width=1)
        draw.line([x, y + card_h + cm_dist, x, y + card_h + cm_dist + cm_len], fill=cm_color, width=1)
        
        # Bottom-Right Crop Mark
        draw.line([x + card_w + cm_dist, y + card_h, x + card_w + cm_dist + cm_len, y + card_h], fill=cm_color, width=1)
        draw.line([x + card_w, y + card_h + cm_dist, x + card_w, y + card_h + cm_dist + cm_len], fill=cm_color, width=1)
        
        # Subdued dashed border bounding the cut line
        draw.rectangle([x - 1, y - 1, x + card_w + 1, y + card_h + 1], outline="#cbd5e1", width=1)

    # Sheet Footer
    draw.line([100, sheet_h - 90, sheet_w - 100, sheet_h - 90], fill="#e2e8f0", width=1)
    draw.text((100, sheet_h - 70), "SmartGeulis Traceability · Department of Agriculture · Universitas Padjadjaran", fill="#94a3b8", font=font_mono)
    draw.text((sheet_w - 360, sheet_h - 70), f"Page {page_num} of {total_pages}", fill="#94a3b8", font=font_mono)
    
    return sheet

def clean_slug(name):
    return re.sub(r'[^a-zA-Z0-9]+', '_', name).strip('_')

def clean_display_name(raw_name):
    """Strip explanatory annotations such as (Istri Pak Suryana) or any parenthetical notes"""
    if not raw_name:
        return "Farmer Name"
    cleaned = re.sub(r'\s*\([^)]*\)', '', raw_name).strip()
    return cleaned if cleaned else raw_name.strip()

def generate_html_gallery(farmers, qr_matrices):
    """Generates an interactive, ready-to-print HTML gallery matching IdCard.tsx"""
    # Copy a lightweight optimized logo into docs/farmer/logo.png for instant loading
    doc_logo_path = os.path.join(DOCS_FARMER_DIR, "logo.png")
    if os.path.exists(LOGO_PATH):
        raw_logo = Image.open(LOGO_PATH)
        thumb_logo = raw_logo.resize((240, 240), Image.Resampling.LANCZOS)
        thumb_logo.save(doc_logo_path, "PNG", optimize=True)

    cards_html = []
    for f in farmers:
        code = f["code"]
        name = clean_display_name(f["name"])
        domicile = f.get("address") or f.get("village") or "Garut, Jawa Barat"
        clean_name = clean_slug(name)
        qr_matrix = qr_matrices[code]
        matrix_dim = len(qr_matrix)
        quiet_zone = 2
        dim = matrix_dim + quiet_zone * 2
        
        qr_path_data = []
        for r in range(matrix_dim):
            for c in range(matrix_dim):
                if qr_matrix[r][c]:
                    qr_path_data.append(f"M{c + quiet_zone} {r + quiet_zone}h1v1h-1z")
        qr_svg_path = "".join(qr_path_data)
        
        card_markup = f"""
        <div class="card-wrapper" id="{code}">
          <div class="card">
            <div class="corner-tl"></div>
            <div class="corner-br"></div>
            
            <div class="header">
              <div class="header-brand">
                <img src="logo.png" alt="Logo" class="brand-logo" />
                <div>
                  <div class="brand-title">SmartGeulis</div>
                  <div class="brand-sub">TRACEABILITY SYSTEM</div>
                </div>
              </div>
              <div class="badge">
                <span class="dot"></span>
                <span>FARMER</span>
              </div>
            </div>
            
            <div class="body">
              <img src="logo.png" alt="" class="watermark" />
              <div class="content-left">
                <div class="field-label">Full Name</div>
                <div class="field-name" title="{name}">{name}</div>
                
                <div class="field-label">Identification Code</div>
                <div class="code-chip">{code}</div>
                
                <div class="field-label">Domicile / Facility</div>
                <div class="field-domicile">{domicile}</div>
                
                <div class="field-label" style="margin-top:1.5mm;">Role / Position</div>
                <div class="field-role">Registered Farmer</div>
              </div>
              
              <div class="qr-frame">
                <svg width="68" height="68" viewBox="0 0 {dim} {dim}" shape-rendering="crispEdges">
                  <rect width="{dim}" height="{dim}" fill="#ffffff" />
                  <path d="{qr_svg_path}" fill="#000000" />
                </svg>
                <span class="qr-caption">SCAN · VERIFY ACCESS</span>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-left">
                <span class="footer-dot"></span>
                <span>AUTHENTICATED PASS</span>
              </div>
              <span>SMARTGEULIS</span>
            </div>
          </div>
          
          <div class="card-actions no-print">
            <span class="action-code">{code}</span>
            <a href="cards_png/{code}_{clean_name}.png" download class="btn-action">Download PNG</a>
            <a href="cards_pdf/{code}_{clean_name}.pdf" download class="btn-action">Download PDF</a>
          </div>
        </div>
        """
        cards_html.append(card_markup)
        
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SmartGeulis · Farmer Identification Cards (Total: {len(farmers)})</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *, *::before, *::after {{
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    body {{
      margin: 0;
      padding: 24px;
      background: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }}
    .container {{
      max-width: 1200px;
      margin: 0 auto;
    }}
    header.page-header {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px 32px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }}
    .brand-group {{
      display: flex;
      align-items: center;
      gap: 16px;
    }}
    .brand-group img {{
      height: 48px;
      width: auto;
    }}
    h1 {{
      margin: 0 0 4px 0;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }}
    p.subtitle {{
      margin: 0;
      color: #64748b;
      font-size: 13px;
    }}
    .header-actions {{
      display: flex;
      gap: 10px;
    }}
    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }}
    .btn-primary {{
      background: #15803d;
      color: #ffffff;
    }}
    .btn-primary:hover {{
      background: #166534;
    }}
    .btn-secondary {{
      background: #ffffff;
      color: #0f172a;
      border-color: #cbd5e1;
    }}
    .btn-secondary:hover {{
      background: #f8fafc;
      border-color: #94a3b8;
    }}
    
    /* Grid of Cards */
    .cards-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 24px;
    }}
    .card-wrapper {{
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }}
    
    /* 80mm x 55mm Real Proportion Card */
    .card {{
      width: 320px;
      height: 220px;
      aspect-ratio: 80 / 55;
      background: #ffffff;
      border: 1px solid #eaeaea;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 14px rgba(0,0,0,0.06);
    }}
    .corner-tl {{
      position: absolute;
      top: 0;
      left: 0;
      width: 10px;
      height: 10px;
      border-top: 2px solid #16a34a;
      border-left: 2px solid #16a34a;
      z-index: 10;
    }}
    .corner-br {{
      position: absolute;
      bottom: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-bottom: 2px solid #16a34a;
      border-right: 2px solid #16a34a;
      z-index: 10;
    }}
    .header {{
      background: #15803d;
      color: #ffffff;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.12);
    }}
    .header-brand {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .brand-logo {{
      height: 20px;
      width: auto;
    }}
    .brand-title {{
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.05em;
      line-height: 1;
    }}
    .brand-sub {{
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 7.5px;
      font-weight: 800;
      color: #86efac;
      letter-spacing: 0.18em;
      margin-top: 2px;
    }}
    .badge {{
      background: #f0fdf4;
      border: 1px solid #86efac;
      color: #14532d;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 8px;
      font-weight: 800;
      padding: 2.5px 7px;
      display: flex;
      align-items: center;
      gap: 4px;
      letter-spacing: 0.08em;
    }}
    .dot {{
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #22c55e;
    }}
    .body {{
      flex: 1;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: #ffffff;
      position: relative;
      overflow: hidden;
    }}
    .watermark {{
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 140px;
      height: 140px;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }}
    .content-left {{
      position: relative;
      z-index: 1;
      flex: 1;
      min-width: 0;
    }}
    .field-label {{
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 7px;
      font-weight: 700;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      line-height: 1;
      margin-bottom: 2px;
    }}
    .field-name {{
      font-size: 13px;
      font-weight: 800;
      color: #171717;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .code-chip {{
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 10px;
      font-weight: 800;
      color: #14532d;
      background: #f0fdf4;
      border: 1px solid #86efac;
      padding: 1.5px 6px;
      letter-spacing: 0.1em;
      margin-bottom: 4px;
    }}
    .field-domicile {{
      font-size: 8.5px;
      font-weight: 600;
      color: #222222;
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .field-role {{
      font-size: 8.5px;
      font-weight: 600;
      color: #171717;
    }}
    .qr-frame {{
      border: 1px solid #eaeaea;
      padding: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      background: #ffffff;
      position: relative;
      z-index: 1;
    }}
    .qr-caption {{
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 6.5px;
      font-weight: 800;
      color: #333333;
      letter-spacing: 0.12em;
    }}
    .footer {{
      border-top: 1px solid #eaeaea;
      padding: 5px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 8px;
      font-weight: 800;
      color: #171717;
      background: #fafafa;
      letter-spacing: 0.12em;
    }}
    .footer-left {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .footer-dot {{
      width: 6px;
      height: 6px;
      background: #16a34a;
    }}
    .card-actions {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }}
    .action-code {{
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-weight: 700;
      color: #475569;
    }}
    .btn-action {{
      padding: 3px 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      color: #0f172a;
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
    }}
    .btn-action:hover {{
      background: #f1f5f9;
      border-color: #94a3b8;
    }}
    
    /* PRINT STYLING */
    @media print {{
      body {{
        background: #ffffff;
        padding: 0;
      }}
      .no-print {{
        display: none !important;
      }}
      .cards-grid {{
        display: grid;
        grid-template-columns: repeat(2, 80mm);
        gap: 8mm;
        justify-content: center;
      }}
      .card-wrapper {{
        page-break-inside: avoid;
        break-inside: avoid;
      }}
      .card {{
        width: 80mm !important;
        height: 55mm !important;
        box-shadow: none !important;
        border: 1px solid #000000 !important;
      }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <header class="page-header no-print">
      <div class="brand-group">
        <img src="logo.png" alt="SmartGeulis" />
        <div>
          <h1>Farmer ID Card Registry · SmartGeulis</h1>
          <p class="subtitle">Official Identity Passes for Station 01 Reception Check-In · Total {len(farmers)} Registered Farmers</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="window.print()">
          🖨️ Print Cards (Browser)
        </button>
        <a href="all_farmers_idcards_A4_print.pdf" class="btn btn-secondary">
          📄 Download A4 Print PDF
        </a>
        <a href="all_farmers_idcards.pdf" class="btn btn-secondary">
          📑 Download Multi-Page PDF
        </a>
      </div>
    </header>
    
    <div class="cards-grid">
      {"".join(cards_html)}
    </div>
  </div>
</body>
</html>
"""
    return full_html

def generate_readme(farmers):
    """Generates README.md for docs/farmer/"""
    a4_total_pages = (len(farmers) + 7) // 8
    table_rows = []
    for f in farmers:
        code = f["code"]
        name = clean_display_name(f["name"])
        village = f.get("village") or "-"
        district = f.get("district") or "-"
        clean_name = clean_slug(name)
        png_link = f"[PNG](cards_png/{code}_{clean_name}.png)"
        pdf_link = f"[PDF](cards_pdf/{code}_{clean_name}.pdf)"
        table_rows.append(f"| `{code}` | **{name}** | {village} | {district} | {png_link} | {pdf_link} |")

    return f"""# 🌾 SmartGeulis Farmer ID Card Collection

Koleksi kartu identitas resmi (**Farmer ID Card**) untuk seluruh petani terdaftar di sistem **SmartGeulis Traceability**. Kartu identitas ini berfungsi sebagai tiket/pass timbang digital saat petani menyerahkan panen kentang di **Station 01 Reception**.

Setiap kartu dilengkapi dengan **QR Code unik** yang memuat kode petani (`FMR-xxx`), alamat/domisili, watermark identitas visual SmartGeulis, dan styling arsitektural berstandar internasional (ukuran kartu standar ISO/IEC 7810 ID-1 / 80 mm × 55 mm).

---

## 🖨️ File Cetak Terpadu (Master Print Documents)

| Nama Dokumen | Format | Deskripsi | Tautan Unduh |
|---|---|---|---|
| **A4 Sheet Print Catalog** | PDF | Siap cetak di kertas A4 (8 kartu per halaman, {a4_total_pages} halaman total) lengkap dengan garis potong (crop marks). | [all_farmers_idcards_A4_print.pdf](file:///home/almuzky/smarthub/docs/farmer/all_farmers_idcards_A4_print.pdf) |
| **All Farmers Card Deck** | PDF | Multi-page PDF ({len(farmers)} halaman, ukuran presisi 80 mm × 55 mm per halaman). | [all_farmers_idcards.pdf](file:///home/almuzky/smarthub/docs/farmer/all_farmers_idcards.pdf) |
| **Interactive Web Gallery** | HTML | Galeri interaktif lengkap dengan fungsi cetak langsung dari browser (`Ctrl + P`). | [index.html](file:///home/almuzky/smarthub/docs/farmer/index.html) |

---

## 📋 Daftar Petani & Kartu Identitas ({len(farmers)} Petani)

| Kode | Nama Petani | Desa | Kecamatan | Gambar (PNG) | Dokumen (PDF) |
|:---:|:---|:---|:---|:---:|:---:|
{chr(10).join(table_rows)}

---

## 📐 Spesifikasi Teknis Kartu

- **Dimensi Standar**: 80 mm × 55 mm (Landscape, ID-1 / CR80 compliant)
- **Resolusi**: 300 DPI (945 × 650 piksel)
- **Format QR Code**: ISO/IEC 18004 Byte Mode, Error Correction Level M
- **Warna Identitas (Theme FARMER)**:
  - Header: `#15803d` (Green Emerald)
  - Subtitle: `#86efac` (Light Mint Green Monospace)
  - Badge Background: `#f0fdf4`
  - Badge Border: `#86efac`
  - Badge Text: `#14532d`
  - Status Dot: `#22c55e`
  - Corner Brackets: `#16a34a`
- **Kompatibilitas Printer**:
  - Inkjet / Laser Printer (A4 Paper / Photo Paper / PVC Sheet)
  - Direct Thermal / Card Printer (Evolis, Zebra, Fargo, Datacard)
"""

def main():
    print("=========================================================")
    print("🌾 SMARTGEULIS FARMER ID CARD GENERATOR")
    print("=========================================================")
    
    os.makedirs(DOCS_FARMER_DIR, exist_ok=True)
    os.makedirs(CARDS_PNG_DIR, exist_ok=True)
    os.makedirs(CARDS_PDF_DIR, exist_ok=True)
    
    # Remove stale card files before regenerating
    for folder in (CARDS_PNG_DIR, CARDS_PDF_DIR):
        for old_file in os.listdir(folder):
            old_path = os.path.join(folder, old_file)
            if os.path.isfile(old_path):
                os.remove(old_path)
    
    # 1. Fetch data
    farmers = get_farmers_data()
    print(f"Loaded {len(farmers)} farmers from database.")
    
    # 2. Generate QR matrices
    farmer_codes = [f["code"] for f in farmers]
    print(f"Generating QR code matrices for {len(farmer_codes)} farmers...")
    qr_matrices = generate_qr_matrices(farmer_codes)
    
    # 3. Load logo
    logo_img = None
    if os.path.exists(LOGO_PATH):
        logo_img = Image.open(LOGO_PATH).convert("RGBA")
        
    font_bold = ImageFont.truetype(FONT_BOLD_PATH, 24)
    font_mono = ImageFont.truetype(FONT_MONO_REG_PATH, 16)
    
    card_images = []
    
    # 4. Generate individual PNG & PDF cards
    print("\nGenerating individual cards (PNG & PDF)...")
    for f in farmers:
        code = f["code"]
        name = clean_display_name(f["name"])
        clean_name = clean_slug(name)
        qr_mat = qr_matrices[code]
        
        # Render image
        card_img = render_id_card_image(f, qr_mat, logo_img)
        card_images.append(card_img)
        
        # Save PNG
        png_filename = f"{code}_{clean_name}.png"
        png_path = os.path.join(CARDS_PNG_DIR, png_filename)
        card_img.save(png_path, "PNG", dpi=(300, 300))
        
        # Save single PDF
        pdf_filename = f"{code}_{clean_name}.pdf"
        pdf_path = os.path.join(CARDS_PDF_DIR, pdf_filename)
        card_img.save(pdf_path, "PDF", resolution=300.0)
        
        print(f"  ✅ {code}: {name} -> {png_filename} & {pdf_filename}")

    # 5. Compile all cards into one multi-page PDF
    print("\nCompiling multi-page PDF (all_farmers_idcards.pdf)...")
    multi_pdf_path = os.path.join(DOCS_FARMER_DIR, "all_farmers_idcards.pdf")
    if card_images:
        card_images[0].save(
            multi_pdf_path,
            "PDF",
            resolution=300.0,
            save_all=True,
            append_images=card_images[1:]
        )
        print(f"  ✅ Multi-page PDF created: {multi_pdf_path} ({len(card_images)} pages)")

    # 6. Compile A4 sheet pages (8 cards per page)
    print("\nCompiling A4 Sheet Print PDF (all_farmers_idcards_A4_print.pdf)...")
    a4_pages = []
    cards_per_page = 8
    total_pages = (len(card_images) + cards_per_page - 1) // cards_per_page
    
    for p in range(total_pages):
        page_num = p + 1
        page_cards = card_images[p * cards_per_page : (p + 1) * cards_per_page]
        sheet_img = create_a4_sheet(page_num, total_pages, page_cards, font_mono, font_bold, font_mono)
        a4_pages.append(sheet_img)
        print(f"  ✅ Rendered A4 sheet page {page_num} of {total_pages} ({len(page_cards)} cards)")
        
    a4_pdf_path = os.path.join(DOCS_FARMER_DIR, "all_farmers_idcards_A4_print.pdf")
    if a4_pages:
        a4_pages[0].save(
            a4_pdf_path,
            "PDF",
            resolution=300.0,
            save_all=True,
            append_images=a4_pages[1:]
        )
        print(f"  ✅ A4 Print PDF created: {a4_pdf_path}")

    # 7. Generate interactive HTML gallery
    print("\nGenerating interactive HTML gallery (index.html)...")
    gallery_html = generate_html_gallery(farmers, qr_matrices)
    gallery_path = os.path.join(DOCS_FARMER_DIR, "index.html")
    with open(gallery_path, "w", encoding="utf-8") as gf:
        gf.write(gallery_html)
    print(f"  ✅ HTML gallery created: {gallery_path}")

    # 8. Generate README.md
    print("\nGenerating README.md index...")
    readme_content = generate_readme(farmers)
    readme_path = os.path.join(DOCS_FARMER_DIR, "README.md")
    with open(readme_path, "w", encoding="utf-8") as rf:
        rf.write(readme_content)
    print(f"  ✅ Documentation created: {readme_path}")
    
    print("\n🎉 ALL FARMER ID CARDS SUCCESSFULLY GENERATED AND SAVED IN docs/farmer/!")

if __name__ == "__main__":
    main()
