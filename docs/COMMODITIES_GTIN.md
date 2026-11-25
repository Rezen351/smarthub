# Daftar Komoditas & Format GTIN-13 (GS1 Indonesia)

Dokumen ini menjadi acuan resmi master komoditas Eptilu beserta format **GTIN-13 (EAN-13)** yang terdaftar pada GS1 Indonesia.

---

## 1. Format Struktur GTIN-13

Setiap komoditas menggunakan format **GTIN-13** standar GS1 dengan panjang **13 digit**:

```text
899 447709 [CCC] [D]
 │     │     │    └─ Check Digit (1 digit, GS1 Modulo-10)
 │     │     └────── Product Number / Kode Komoditas (3 digit)
 │     └──────────── GS1 Company Prefix Eptilu (6 digit: 447709)
 └────────────────── Kode Negara GS1 Indonesia (3 digit: 899)
```

- **GS1 Company Prefix (GCP)**: `899447709` (9 digit)
- **Format GTIN-13**: `899447709{PRODUCT_NUMBER}{CHECK_DIGIT}`
- **Format GTIN-14 (ITF-14 / Kemasan Logistik)**: `0` + `GTIN-13` (contoh: `08994477090010`) atau indikator kemasan logistik `1`–`8` + 12 digit pertama + check digit baru.
- **Format GS1 Digital Link (QR)**: `https://trace.smartgeulis.id/01/{GTIN-13}/10/{LOT}/21/{SERIAL}`

### Perhitungan Check Digit (GS1 Modulo-10)
Untuk 12 digit pertama ($d_1 \dots d_{12}$ dari kiri):
- Digit pada posisi ganjil ($d_1, d_3, \dots, d_{11}$) dikalikan `1`.
- Digit pada posisi genap ($d_2, d_4, \dots, d_{12}$) dikalikan `3`.
- $\text{Check Digit} = (10 - (\text{Total} \bmod 10)) \bmod 10$.

---

## 2. Daftar Komoditas Terdaftar

| No | Product Number | General Name (Penerimaan) | Export SKU / Package Name | GTIN-13 | Package | Product Brand | Weight Unit |
|---:|----------------|---------------------------|---------------------------|---------|---------|---------------|-------------|
| 1 | `001` | Kentang | Eptilu Washed Potatoes 10 kg | `8994477090010` | Carton Box | Eptilu | Kilogram (`kg`) |
| 2 | `101` | Tomat | Eptilu Fresh Red Tomatoes TW 10 kg | `8994477091017` | Carton Box | Eptilu | Kilogram (`kg`) |
| 3 | `201` | Cabe Merah Keriting | Eptilu Fresh Curly Red Chili Peppers 10 kg | `8994477092014` | Carton Box | Eptilu | Kilogram (`kg`) |
| 4 | `202` | Cabe Rawit Merah | Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg | `8994477092021` | Carton Box | Eptilu | Kilogram (`kg`) |

---

## 3. Klasifikasi GS1 GPC (Global Product Classification)

| Product Number | Product Name | Segment | Family | Class | Brick |
|----------------|--------------|---------|--------|-------|-------|
| `202` | Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg | Food/Beverage/Tobacco | Vegetables (Non Leaf) - Unprepared/Unprocessed (Fresh) | Peppers | Hot Peppers |
| `201` | Eptilu Fresh Curly Red Chili Peppers 10 kg | Food/Beverage/Tobacco | Vegetables (Non Leaf) - Unprepared/Unprocessed (Fresh) | Peppers | Chilli Peppers |
| `101` | Eptilu Fresh Red Tomatoes TW 10 kg | Food/Beverage/Tobacco | Vegetables (Non Leaf) - Unprepared/Unprocessed (Fresh) | Tomatoes | Tomatoes - Round |
| `001` | Eptilu Washed Potatoes 10 kg | Food/Beverage/Tobacco | Vegetables (Non Leaf) - Unprepared/Unprocessed (Fresh) | Vegetables - Unprepared/Unprocessed (Fresh) Variety Packs | Vegetables - Unprepared/Unprocessed (Fresh) Variety Packs |

---

## 4. Alur Pemisahan Penerimaan Komoditas Umum vs. Spesifikasi Ekspor di Pengemasan

1. **Tahap Penerimaan (Station 01 — Reception)**:
   - Petani menyetorkan hasil panen komoditas mentah.
   - Pilihan komoditas pada layar timbang dan struk penerimaan murni menggunakan nama umum: **Kentang**, **Tomat**, **Cabe Merah Keriting**, dan **Cabe Rawit Merah**.
   - Tidak memuat atribut ekspor (tanpa kode GTIN-13, barcode GS1-128, atau penamaan box ekspor).

2. **Tahap Pengemasan (Station 03 — Packaging) & Ekspor**:
   - Ketika pallet hasil grading dipilih di stasiun pengemasan, sistem secara otomatis mengaitkan spesifikasi ekspor dan GS1 GTIN-13 yang sesuai:
     - Kentang $\rightarrow$ Eptilu Washed Potatoes 10 kg (GTIN-13: `8994477090010`)
     - Tomat $\rightarrow$ Eptilu Fresh Red Tomatoes TW 10 kg (GTIN-13: `8994477091017`)
     - Cabe Merah Keriting $\rightarrow$ Eptilu Fresh Curly Red Chili Peppers 10 kg (GTIN-13: `8994477092014`)
     - Cabe Rawit Merah $\rightarrow$ Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg (GTIN-13: `8994477092021`)
   - Barcode GS1-128 (`010{GTIN}21{SERIAL}`) dan QR GS1 Digital Link dicetak pada kemasan pouch atau karton ekspor.

---

## 4. Contoh GS1 Digital Link per Komoditas

| Product Number | Product Name | Contoh URI GS1 Digital Link |
|----------------|--------------|-----------------------------|
| `202` | Eptilu Fresh Red Bird's Eye Chili Peppers 10 kg | `https://trace.smartgeulis.id/01/8994477092021/10/PLT-20261025-0004-A/21/PCH-20261025-0004` |
| `201` | Eptilu Fresh Curly Red Chili Peppers 10 kg | `https://trace.smartgeulis.id/01/8994477092014/10/PLT-20261025-0003-A/21/PCH-20261025-0003` |
| `101` | Eptilu Fresh Red Tomatoes TW 10 kg | `https://trace.smartgeulis.id/01/8994477091017/10/PLT-20261025-0002-A/21/PCH-20261025-0002` |
| `001` | Eptilu Washed Potatoes 10 kg | `https://trace.smartgeulis.id/01/8994477090010/10/PLT-20261025-0001-A/21/PCH-20261025-0001` |
