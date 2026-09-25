# Bill of Materials (BOM) — E-Tani Smart Hub

**Project**: E-Tani Smart Hub  
**Document Version**: 1.0  
**Date**: 2026-09-15  
**Standard**: IEC 81346 / ISO 10007  
**Currency**: Indonesian Rupiah (IDR)  
**Prices Source**: Web search from Indonesian e-commerce & distributor (Shopee, Tokopedia, Indotrading, Blueprint Indonesia, etc.)  
**Note**: Harga adalah estimasi pasar Indonesia pada tahun 2026. Harga dapat berubah sesuai seller, stok, dan lokasi.

---

## 1. Ringkasan Biaya

| Kategori | Estimasi Total (IDR) |
|----------|---------------------|
| Edge / MCU & IoT | Rp 2.500.000 — Rp 4.500.000 |
| Field Devices (Scanner, Printer, Scale accessories) | Rp 4.000.000 — Rp 8.000.000 |
| Networking & Infrastructure | Rp 1.500.000 — Rp 3.500.000 |
| Application Server & Database | Rp 5.000.000 — Rp 12.000.000 |
| Consumables & Spare Parts | Rp 1.000.000 — Rp 2.500.000 |
| **TOTAL ESTIMATED** | **Rp 38.345.000 — Rp 62.200.000** |

---

## 2. Edge / MCU & IoT Components

### 2.1 Mikrokontroler (MCU)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | ESP32-DOIT-V1 | ESP32 Development Board DOIT DevKit V1 | ESP32-WROOM-32, Dual-core 240MHz, WiFi+BT, 4MB Flash, USB Type-C, CH340C, 30-pin | 3 | Rp 85.000 | Rp 255.000 | Shopee / Tokopedia | MCU1: Area Penerimaan, MCU2: Area Sortir, MCU3: Backup/Testing |
| 2 | ESP32-S3-N16R8 | ESP32-S3 DevKit (upgrade option) | 16MB Flash, 8MB PSRAM, USB-C, WiFi+BT5, AI-ready | 2 | Rp 350.000 | Rp 700.000 | Tokopedia | Optional upgrade untuk preprocessing data lebih berat |
| 3 | USB-CABLE-1M | USB Data Cable Type-C 1 meter | Untuk programming & power ESP32 | 3 | Rp 25.000 | Rp 75.000 | Lokal | Wajib untuk flash firmware & debugging |
| 4 | FILAMENT-PLA-1KG | 3D Printer Filament PLA 1kg | 1.75mm, various colors, untuk enclosure MCU & bracket | 4 | Rp 150.000 | Rp 600.000 | Tokopedia / Shopee | Filament untuk cetak enclosure custom MCU |
| 5 | FILAMENT-PETG-1KG | 3D Printer Filament PETG 1kg | 1.75mm, water-resistant, untuk outdoor parts | 2 | Rp 180.000 | Rp 360.000 | Tokopedia / Shopee | Material lebih tahan air untuk bagian outdoor |
| 6 | MOUNTING-HARDWARE | Mounting Hardware Kit (screws, nuts, standoff) | M3/M4 screws, nylon standoff, untuk assemble 3D printed parts | 1 | Rp 75.000 | Rp 75.000 | Tokopedia | Hardware untuk mounting MCU & module |
| 7 | DIN-RAIL-MOUNT | DIN Rail Mount Bracket untuk ESP32 | Aluminum, kompatibel dengan ESP32 DevKit | 2 | Rp 30.000 | Rp 60.000 | Indotrading | Mounting di panel listrik/rack |
| 8 | JUMPER-WIRE-KIT | Jumper Wire Kit Male-to-Male & Female-to-Female | 20cm, assorted colors, 120 pcs | 2 | Rp 35.000 | Rp 70.000 | Shopee | Prototyping & koneksi perangkat |
| 9 | BREADBOARD-830 | Breadboard 830 points | Solderless, untuk testing | 2 | Rp 30.000 | Rp 60.000 | Shopee | Testing sebelum final assembly |
| 10 | POWER-SUPPLY-5V-3A | Power Supply 5V 3A DC | Untuk power ESP32 & Aksesori | 3 | Rp 45.000 | Rp 135.000 | Tokopedia | Stabilkan power, hindari brown-out |

**Subtotal Edge/MCU**: **Rp 2.390.000**

### 2.2 RS485 Communication Modules

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | MAX485-MODULE | MAX485 TTL to RS485 Converter Module | MAX485 chip, 5V, half-duplex, 2.5Mbps, screw terminal, LED indicator, 120-ohm termination | 4 | Rp 25.000 | Rp 100.000 | Shopee / Tokopedia | Interface MCU ke Timbangan RS485 |
| 2 | MAX3485-MODULE | MAX3485 TTL to RS485 Converter Module (auto direction) | MAX3485, 3.3V/5V, auto direction control, ESD protection, higher speed up to 12Mbps | 2 | Rp 45.000 | Rp 90.000 | iFuture Technology / Shopee | Alternative dengan auto-direction, lebih reliable |
| 3 | RS485-CABLE-2P | RS485 Twisted Pair Cable | 2-pin twisted, shielded, 1.5mm², per meter | 10 | Rp 15.000 | Rp 150.000 | Tokopedia | Koneksi MCU ke Timbangan RS485 |
| 4 | TERMINAL-BLOCK-2P | Terminal Block Connector 2-pin | 5.08mm pitch, screw type, untuk RS485 | 10 | Rp 3.000 | Rp 30.000 | Tokopedia | Koneksi yang aman & stabil |
| 5 | CABLE-GLAND-PG7 | Cable Gland PG7 | Waterproof, untuk kabel masuk ke enclosure | 6 | Rp 5.000 | Rp 30.000 | Shopee | Proteksi kabel masuk ke project box |
| 6 | HEATSHRINK-5MM | Heat Shrink Tube 5mm | assortment, untuk insulation | 1 | Rp 20.000 | Rp 20.000 | Tokopedia | Insulation koneksi |

**Subtotal RS485**: **Rp 420.000**

---

## 3. Field Devices (Lapangan)

### 3.1 Timbangan RS485 (Weighing Scales)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | SCALE-BIG-200KG | Timbangan Duduk Digital 200kg RS485/RS232 | Kapasitas 200kg, resolusi 10g, indikator LED, output RS485/RS232, platform 40x50cm | 1 | Rp 2.500.000 | Rp 2.500.000 | PT. Altraman / Indotrading | **Timbangan Besar Area Penerimaan** — timbang karung/pallet awal |
| 2 | SCALE-GRADE-A-100KG | Timbangan Duduk Digital 100kg RS485 | Kapasitas 100kg, resolusi 5g, output RS485, platform 30x40cm | 1 | Rp 1.800.000 | Rp 1.800.000 | PT. Altraman / Tokopedia | **Timbangan Grade A** — area sortir |
| 3 | SCALE-GRADE-B-100KG | Timbangan Duduk Digital 100kg RS485 | Kapasitas 100kg, resolusi 5g, output RS485, platform 30x40cm | 1 | Rp 1.800.000 | Rp 1.800.000 | PT. Altraman / Tokopedia | **Timbangan Grade B** — area sortir |
| 4 | SCALE-GRADE-C-100KG | Timbangan Duduk Digital 100kg RS485 | Kapasitas 100kg, resolusi 5g, output RS485, platform 30x40cm | 1 | Rp 1.800.000 | Rp 1.800.000 | PT. Altraman / Tokopedia | **Timbangan Grade C** — area sortir |
| 5 | LOADCELL-500KG | Load Cell Sensor 500kg | Timbangan spare part, untuk maintenance/calibrasi | 1 | Rp 450.000 | Rp 450.000 | Tokopedia | Cadangan load cell |
| 6 | INDICATOR-DIGITAL | Digital Weight Indicator dengan RS485 | 6-digit display, backlight, RS485 output, untuk upgrade timbangan lama | 1 | Rp 1.200.000 | Rp 1.200.000 | Indotrading | Jika timbangan existing belum punya RS485 |

**Subtotal Timbangan**: **Rp 10.550.000**

> **Catatan**: Harga timbangan sangat bervariasi tergantung merek, kapasitas, dan kelengkapan output RS485. Disarankan beli paket timbangan + indikator RS485 dari distributor resmi (PT. Altraman, Rice Lake, atau lokal sejenis).

### 3.2 Barcode / QR Scanners

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | SCANNER-2D-USB | Handheld Barcode Scanner 2D USB | QR Code, EAN-13, Code 128, USB HID (plug & play), auto-scan, 1D+2D | 2 | Rp 350.000 | Rp 700.000 | Tokopedia / Shopee | **Scanner Area Penerimaan** & **Scanner Area Warehouse In** |
| 2 | SCANNER-OMNI-2D | Omnidirectional Desktop Barcode Scanner 2D | USB, hands-free, auto-sensing, QR+EAN+ITF, untuk area packing cepat | 1 | Rp 763.500 | Rp 763.500 | Blueprint Indonesia / Tokopedia | **Scanner Area Pengemasan** — hands-free untuk operator |
| 3 | SCANNER-HONEYWELL | Honeywell Voyager 1250G / XP 1470G | USB, 1D/2D, industrial grade, durable | 1 | Rp 1.873.000 | Rp 1.873.000 | Indotrading | Optional — untuk lingkungan industri berat |
| 4 | SCANNER-CABLE-USB | USB Extension Cable 2 meter | Untuk scanner yang posisi jauh dari PC | 2 | Rp 35.000 | Rp 70.000 | Tokopedia | Fleksibilitas penempatan scanner |

**Subtotal Scanner**: **Rp 3.406.500**

### 3.3 Label Printers

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | PRINTER-LABEL-4IN | Thermal Label Printer 4 inch | Direct Thermal, 203dpi, 4 inch (108mm) width, USB+LAN, supports QR, EAN-13, ITF-14 | 1 | Rp 2.500.000 | Rp 2.500.000 | Blueprint Indonesia / Bhinneka | **Printer Utama** — cetak label pouch (QR+EAN-13) & packaging (ITF-14) |
| 2 | PRINTER-TERMAL-58MM | Thermal Receipt Printer 58mm | 58mm, USB+Bluetooth, ESC/POS, untuk test print & struk | 1 | Rp 395.000 | Rp 395.000 | Blueprint Indonesia | Testing label & print struk dokumentasi |
| 3 | PRINTER-TERMAL-80MM | Thermal Receipt Printer 80mm | 80mm, USB+LAN+Bluetooth, auto cutter, 200mm/s | 1 | Rp 958.600 | Rp 958.600 | Blueprint Indonesia | Print dokumen pengiriman & manifest |
| 4 | RIBBON-THERMAL-4IN | Thermal Transfer Ribbon 4 inch | Wax/Resin, 110mm x 300m, untuk thermal transfer printer | 3 | Rp 85.000 | Rp 255.000 | Bhinneka / Blueprint | Konsumsi bulanan |
| 5 | LABEL-PAPER-4IN | Direct Thermal Label Paper 4 inch | 100mm x 150mm, 500 pcs/roll, direct thermal | 5 | Rp 65.000 | Rp 325.000 | Blueprint Indonesia | Label pouch 1kg |
| 6 | LABEL-PAPER-ITF | ITF-14 Label Paper 4 inch | 100mm x 100mm, 500 pcs/roll, untuk packaging ekspor | 3 | Rp 75.000 | Rp 225.000 | Blueprint Indonesia | Label packaging 10kg/50kg |
| 7 | PAPER-RECEIPT-58MM | Thermal Receipt Paper 58mm | 57x40mm, 500 pcs/roll | 5 | Rp 15.000 | Rp 75.000 | Tokopedia | Konsumsi printer struk |
| 8 | PAPER-RECEIPT-80MM | Thermal Receipt Paper 80mm | 80x60mm, 500 pcs/roll | 5 | Rp 25.000 | Rp 125.000 | Tokopedia | Konsumsi printer struk |

**Subtotal Printer & Consumables**: **Rp 4.853.600**

---

## 4. Networking & Infrastructure

### 4.1 Router & Switch

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | ROUTER-WIFI-6 | Wi-Fi 6 Router Gigabit | Dual-band AX1800, 4x LAN Gigabit, WiFi 6, support VLAN | 1 | Rp 450.000 | Rp 450.000 | Tokopedia / Shopee | Router utama untuk jaringan lokal & internet |
| 2 | SWITCH-8PORT-GIGA | 8-Port Gigabit Unmanaged Switch | Metal casing, 10/100/1000Mbps, plug & play | 1 | Rp 365.000 | Rp 365.000 | Kharisma Kencana / Tokopedia | Switch untuk konek semua device (MCU, scanner, printer, PC) |
| 3 | SWITCH-16PORT-GIGA | 16-Port Gigabit Smart Managed Switch | Cloud managed, VLAN, QoS, untuk skala besar | 1 | Rp 1.200.000 | Rp 1.200.000 | Ruijie / Indotrading | Optional — untuk scaling jika device bertambah |
| 4 | ROUTER-4G-LTE | 4G LTE Router Backup | SIM card slot, failover, untuk backup internet | 1 | Rp 350.000 | Rp 350.000 | Tokopedia | Backup jika internet utama putus |

**Subtotal Router & Switch**: **Rp 2.365.000**

### 4.2 Kabel & Konektor

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | LAN-CABLE-CAT6-305M | UTP CAT6 Cable 305 Meter | Copper, 23AWG, untuk jaringan LAN | 1 | Rp 425.000 | Rp 425.000 | Kharisma Kencana | Kabel jaringan utama |
| 2 | RJ45-CONNECTOR-50 | RJ45 Connector CAT6 (50 pcs) | Plug konektor LAN | 2 | Rp 45.000 | Rp 90.000 | Tokopedia | terminated cable |
| 3 | LAN-CABLE-PATCH-1M | LAN Cable Patch 1 meter | CAT6, finished, untuk konek device ke switch | 10 | Rp 25.000 | Rp 250.000 | Tokopedia | Kabel patch antar device |
| 4 | POWER-EXTENSION-3M | Power Extension Cable 3 meter | dengan switch, untuk power device | 5 | Rp 30.000 | Rp 150.000 | Tokopedia | Power distribution |
| 5 | USB-EXTENSION-2M | USB Extension Cable 2 meter | USB-A female to male, untuk scanner/printer | 3 | Rp 35.000 | Rp 105.000 | Tokopedia | Fleksibilitas penempatan USB device |
| 6 | VELCRO-CABLE-5M | Velcro Cable Tie 5 meter | Reusable, untuk management kabel | 2 | Rp 20.000 | Rp 40.000 | Shopee | Organisasi kabel rapi |

**Subtotal Kabel & Konektor**: **Rp 1.060.000**

### 4.3 Rack & Mounting

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | RACK-WALL-6U | Wall Mount Rack Cabinet 6U | 19 inch, 6U, glass door, ventilated | 1 | Rp 850.000 | Rp 850.000 | Tokopedia | Mounting server, switch, patch panel |
| 2 | PDU-6OUTLET | Power Distribution Unit 6 outlet | 6 outlet, dengan switch & overload protection | 1 | Rp 250.000 | Rp 250.000 | Tokopedia | Power management di rack |
| 3 | RACK-SHELF-1U | 1U Fixed Shelf | Untuk placing device di rack | 2 | Rp 75.000 | Rp 150.000 | Tokopedia | Tempat server/mini PC |
| 4 | VENTILATION-FAN | Rack Ventilation Fan 12cm | 12cm, 120mm, untuk cooling rack | 2 | Rp 85.000 | Rp 170.000 | Tokopedia | Cooling airflow |

**Subtotal Rack & Mounting**: **Rp 1.420.000**

---

## 5. Application Server & Database

### 5.1 Server / Mini PC

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | MINI-PC-N100 | Mini PC Intel N100 (barebone) | Intel N100 4-core, 16GB RAM, 512GB NVMe SSD, WiFi 6, BT 5.2, 2xLAN, Win11/Linux | 1 | Rp 4.500.000 | Rp 4.500.000 | Blibli / Tokopedia | **PC Server Lokal** — Backend, MQTT Broker, Database, Web Server |
| 2 | MINI-PC-N100-2 | Mini PC Intel N100 (barebone) — Backup/DR | Sama seperti di atas | 1 | Rp 4.500.000 | Rp 4.500.000 | Blibli / Tokopedia | **Backup Server** — untuk DR / Cloud sync |
| 3 | RAM-16GB-DDR5 | RAM DDR5 16GB SODIMM | 4800MHz, untuk upgrade/replace | 1 | Rp 650.000 | Rp 650.000 | Tokopedia | Cadangan RAM |
| 4 | SSD-NVME-512GB | NVMe SSD 512GB | M.2 2280, PCIe 3.0/4.0 | 1 | Rp 750.000 | Rp 750.000 | Tokopedia | Cadangan storage |
| 5 | UPS-600VA | UPS 600VA / 360W | Pure sine wave, battery backup, protection | 1 | Rp 850.000 | Rp 850.000 | Tokopedia | Proteksi server dari power outage |
| 6 | UPS-1000VA | UPS 1000VA / 600W | Pure sine wave, untuk server + switch + router | 1 | Rp 1.500.000 | Rp 1.500.000 | Tokopedia | Proteksi seluruh sistem |

**Subtotal Server & UPS**: **Rp 12.750.000**

---

## 6. Software & OS (Open Source / Free)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | UBUNTU-SERVER-22.04 | Ubuntu Server 22.04 LTS | OS untuk server, free download | 1 | Rp 0 | Rp 0 | ubuntu.com | Operating System |
| 2 | POSTGRESQL-17 | PostgreSQL 17 | Relational Database, open source | 1 | Rp 0 | Rp 0 | postgresql.org | Primary Database |
| 3 | TIMESCALEDB | TimescaleDB Extension | Time-series extension untuk PostgreSQL | 1 | Rp 0 | Rp 0 | timescale.com | IoT readings |
| 4 | MOSQUITTO | Eclipse Mosquitto 2.x | MQTT Broker, open source | 1 | Rp 0 | Rp 0 | mosquitto.org | IoT messaging |
| 5 | NODEJS-20 | Node.js 20 LTS | Runtime backend | 1 | Rp 0 | Rp 0 | nodejs.org | Backend runtime |
| 6 | NGINX | Nginx | Web Server / Reverse Proxy | 1 | Rp 0 | Rp 0 | nginx.com | Serve frontend + proxy API |
| 7 | DOCKER-COMPOSE | Docker & Docker Compose | Container orchestration | 1 | Rp 0 | Rp 0 | docker.com | Deploy semua service |

**Subtotal Software**: **Rp 0**

---

## 7. Consumables & Spare Parts

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | ESP32-BACKUP | ESP32 DevKit Board (backup) | Untuk spare part jika MCU rusak | 2 | Rp 85.000 | Rp 170.000 | Shopee | Spare part |
| 2 | MAX485-BACKUP | MAX485 Module (backup) | Spare RS485 module | 4 | Rp 25.000 | Rp 100.000 | Shopee | Spare part |
| 3 | FAN-12V-40MM | Fan 40mm 12V DC | Replacement fan untuk MCU & rack | 4 | Rp 25.000 | Rp 100.000 | Tokopedia | Cooling backup |
| 4 | POWER-ADAPTER-5V | Power Adapter 5V 2A | Replacement power supply | 2 | Rp 35.000 | Rp 70.000 | Tokopedia | Power backup |
| 5 | HEATSHRINK-KIT | Heat Shrink Tubing Kit | Assorted sizes, untuk insulation | 1 | Rp 35.000 | Rp 35.000 | Shopee | Maintenance |
| 6 | CRIMPING-TOOL | RJ45 Crimping Tool | Untuk terminated LAN cable | 1 | Rp 50.000 | Rp 50.000 | Tokopedia | Maintenance kabel |
| 7 | CABLE-TESTER | Network Cable Tester | RJ45 tester, untuk cek kabel LAN | 1 | Rp 30.000 | Rp 30.000 | Shopee | Maintenance kabel |
| 8 | SCREWDRIVER-SET | Precision Screwdriver Set | Untuk perbaikan MCU & elektronik | 1 | Rp 75.000 | Rp 75.000 | Tokopedia | Maintenance |
| 9 | ANTI-STATIC-WRIST | Anti-Static Wrist Strap | Proteksi komponen elektrostatik | 2 | Rp 25.000 | Rp 50.000 | Shopee | Safety saat handling PCB |
| 10 | BATTERY-9V | Battery 9V (for scale backup) | Alkaline, untuk timbangan portable | 4 | Rp 15.000 | Rp 60.000 | Tokopedia | Power backup timbangan |
| 11 | SD-CARD-16GB | Micro SD Card 16GB Class 10 | Untuk firmware backup & data logging | 2 | Rp 65.000 | Rp 130.000 | Tokopedia | Backup firmware ESP32 |
| 12 | LABEL-PROTECTOR | Label Protective Film Lamination | Untuk proteksi label pouch dari air/kerusakan | 1 | Rp 50.000 |Rp 50.000 | Shopee | Durability label |

**Subtotal Consumables & Spare**: **Rp 920.000**

---

## 8. Testing & Calibration Tools

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | CALIBRATION-WEIGHT-1KG | Calibration Weight 1kg | Besi, terkalibrasi, untuk test timbangan | 2 | Rp 150.000 | Rp 300.000 | Tokopedia | Testing timbangan |
| 2 | CALIBRATION-WEIGHT-5KG | Calibration Weight 5kg | Besi, terkalibrasi | 1 | Rp 400.000 | Rp 400.000 | Tokopedia | Testing timbangan |
| 3 | CALIBRATION-WEIGHT-10KG | Calibration Weight 10kg | Besi, terkalibrasi | 1 | Rp 700.000 | Rp 700.000 | Tokopedia | Testing timbangan |
| 4 | MULTIMETER | Digital Multimeter | Auto-ranging, untuk test kelistrikan | 1 | Rp 150.000 | Rp 150.000 | Shopee | Test rangkaian elektro |
| 5 | OSCILLOSCOPE-MINI | Mini Oscilloscope | USB, untuk test sinyal RS485 | 1 | Rp 350.000 | Rp 350.000 | Tokopedia | Debug RS485 signal |
| 6 | THERMOMETER-DIGITAL | Digital Thermometer | Untuk test suhu ruang server & gudang | 1 | Rp 50.000 | Rp 50.000 | Shopee | Environmental monitoring |

**Subtotal Testing Tools**: **Rp 1.950.000**

---

## 9. Safety & Protection

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | SURGE-PROTECTOR | Surge Protector / Power Strip | 5 outlet, surge protection, 2 meter | 2 | Rp 120.000 | Rp 240.000 | Tokopedia | Proteksi perangkat dari listrik |
| 2 | FIRST-AID-KIT | First Aid Kit | Standard, untuk keamanan kerja | 1 | Rp 100.000 | Rp 100.000 | Shopee | Safety |
| 3 | FIRE-EXTINGUISHER | Fire Extinguisher ABC | 1kg, untuk area server & gudang | 2 | Rp 150.000 | Rp 300.000 | Tokopedia | Safety |
| 4 | SAFETY-GLASSES | Safety Glasses | Proteksi mata saat instalasi | 2 | Rp 25.000 | Rp 50.000 | Shopee | Safety |
| 5 | GLOVES-INSULATED | Insulated Work Gloves | Proteksi tangan saat kerja listrik | 2 | Rp 35.000 | Rp 70.000 | Tokopedia | Safety |

**Subtotal Safety**: **Rp 760.000**

---

## 10. Software Licenses & Services (Optional)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | CLOUD-BACKUP | Cloud PostgreSQL (Neon / Supabase) | Managed PostgreSQL untuk backup/DR, starting from | 1 | Rp 200.000/bulan | Rp 2.400.000/tahun | neon.tech / supabase.com | Disaster Recovery |
| 2 | DOMAIN-NAME | Domain Name (.com / .id) | Annual fee | 1 | Rp 175.000/tahun | Rp 175.000/tahun | Namecheap / Niagahoster | Custom domain untuk akses web |
| 3 | SSL-CERTIFICATE | SSL Certificate (Let's Encrypt) | Gratis untuk 1 tahun, auto-renewal | 1 | Rp 0 | Rp 0 | letsencrypt.org | HTTPS |
| 4 | CDN-CLOUDFLARE | Cloudflare CDN | Free tier sudah cukup untuk MVP | 1 | Rp 0 | Rp 0 | cloudflare.com | DNS + DDoS protection |
| 5 | MONITORING-UPTIME | Uptime Monitoring Service | Gratis tier available (UptimeRobot, StatusCake) | 1 | Rp 0 | Rp 0 | uptimerobot.com | Monitoring server |

**Subtotal Software Services (1 year)**: **Rp 2.575.000**

---

## 11. Total BOM Summary

| No | Kategori | Estimasi Minimum (IDR) | Estimasi Maksimum (IDR) | Recommended (IDR) |
|----|----------|------------------------|------------------------|-------------------|
| 1 | Edge / MCU & IoT | Rp 2.390.000 | Rp 3.500.000 | Rp 2.900.000 |
| 2 | Field Devices | Rp 14.500.000 | Rp 24.000.000 | Rp 18.000.000 |
| 3 | Networking & Infrastructure | Rp 4.500.000 | Rp 7.500.000 | Rp 5.500.000 |
| 4 | Application Server & Database | Rp 12.750.000 | Rp 18.000.000 | Rp 14.500.000 |
| 5 | Consumables & Spare Parts | Rp 920.000 | Rp 1.500.000 | Rp 1.200.000 |
| 6 | Testing & Calibration | Rp 1.950.000 | Rp 2.500.000 | Rp 2.000.000 |
| 7 | Safety & Protection | Rp 760.000 | Rp 1.200.000 | Rp 900.000 |
| 8 | Software Licenses & Services (1 year) | Rp 575.000 | Rp 4.000.000 | Rp 2.000.000 |
| | **TOTAL** | **Rp 38.345.000** | **Rp 62.200.000** | **Rp 47.000.000** |

---

## 12. Catatan Penting

### 12.1 Asumsi & Sumber Harga
- Harga diambil dari pencarian web di e-commerce Indonesia (Shopee, Tokopedia, Blueprint Indonesia, Indotrading) dan situs distributor elektronik pada bulan September 2026.
- Harga dapat berubah sewaktu-waktu tergantung stok, lokasi, dan seller.
- Disarankan untuk **minta penawaran resmi (quotation)** dari distributor lokal sebelum melakukan pembelian dalam jumlah besar.

### 12.2 Rekomendasi Pembelian
1. **ESP32 & Module Elektronik**: Beli di Shopee/Tokopedia dengan seller terpercaya (rating > 4.8) untuk harga terbaik.
2. **Timbangan**: Beli langsung dari distributor resmi (PT. Altraman, Rice Lake Indonesia, atau distributor lokal) untuk garansi & kalibrasi resmi. Jangan beli timbangan tidak bermerek untuk komersial.
3. **Scanner & Printer**: Beli di Blueprint Indonesia, Kios Barcode, atau distributor resmi (Honeywell, Zebra, TSC) untuk garansi.
4. **Mini PC / Server**: Beli di Blibli, Tokopedia, atau distributor resmi (ASUS NUC, Beelink, GEEKOM) untuk garansi resmi.
5. **Networking**: Beli di Kharisma Kencana, Ruijie distributor, atau Tokopedia untuk harga kompetitif.

### 12.3 Scaling & Future Expansion
- BOM di atas untuk **MVP / Pilot Project** (1 lokasi, skala menengah).
- Jika perlu **multi-lokasi** atau **skala besar**, pertimbangkan:
  - Tambah 1-2 Mini PC untuk edge gateway per lokasi
  - Tambah switch managed 24-port
  - Tambah Raspberry Pi Zero 2 W sebagai edge gateway lightweight
  - Pertimbangkan managed MQTT broker (HiveMQ Cloud / AWS IoT Core)

### 12.4 Compliance & Standards
- **GS1 Compliance**: Label pouch (QR + EAN-13) dan packaging (ITF-14) mengikuti standar GS1 Indonesia.
- **MQTT QoS**: Scale readings menggunakan QoS 1 (at least once); commands menggunakan QoS 0 (at most once).
- **Database**: PostgreSQL 17 + TimescaleDB untuk time-series optimization.
- **Security**: Semua komunikasi API menggunakan HTTPS; MQTT menggunakan password authentication; firewall rules untuk isolate IoT network.

---

## 13. Referensi Harga

| Sumber | URL | Diakses |
|--------|-----|---------|
| Shopee Indonesia | https://shopee.co.id | 2026-09-15 |
| Tokopedia | https://www.tokopedia.com | 2026-09-15 |
| Blueprint Indonesia | https://www.blueprint-indonesia.com | 2026-09-15 |
| Indotrading | https://www.indotrading.com | 2026-09-15 |
| Kharisma Kencana | https://kharismakencana.com | 2026-09-15 |
| PT. Altraman | https://pt-altraman.com | 2026-09-15 |
| Bhinneka | https://www.bhinneka.com | 2026-09-15 |
| JakartaNotebook | https://www.jakartanotebook.com | 2026-09-15 |

---

## 14. Approval & Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-09-15 | Kilo Agent | Initial BOM creation based on system architecture & Indonesia price search |

---

**End of Document**
