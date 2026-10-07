# Bill of Materials (BOM) — Weight Transmitter Multi-Core

**Product Line**: ENYX Weight Transmitter Multi-Core  
**Firmware Version**: 1.5  
**Document Version**: 2.0  
**Date**: 2026-09-30  
**Standard**: IEC 81346 / ISO 10007  
**Currency**: Indonesian Rupiah (IDR)  
**Prices Source**: Web search from Indonesian e-commerce & distributor (Shopee, Tokopedia, Indotrading, Blueprint Indonesia, etc.)  
**Note**: Harga adalah estimasi pasar Indonesia pada tahun 2026. Harga dapat berubah sesuai seller, stok, dan lokasi.

---

## 1. Product Overview

The **Weight Transmitter Multi-Core** is an autonomous edge device that:

1. Acquires mass data from a strain-gauge load cell via an **HX711** 24-bit ADC.
2. Publishes real-time weight over **Modbus TCP** on both **WiFi** and **Ethernet** simultaneously (dual-transport), acting as a Modbus server on port 502.
3. Provides a **captive-portal web UI** for device configuration and calibration — reachable **only via WiFi Soft-AP** (`192.168.4.1`), regardless of Ethernet or STA state.
4. Runs in **dual WiFi mode** simultaneously: Soft-AP (configuration hotspot) + STA uplink (user network), both always-on.
5. Uses **W5500 Ethernet** for Modbus TCP only; portal access and WiFi STA remain independent.

### Supported Variants

| Variant | MCU | Cores | Notes |
|---------|-----|-------|-------|
| WT-S3 | ESP32-S3 DevKitC-1 | 2 Xtensa LX7 | Primary variant, native USB, 240 MHz |
| WT-32 | ESP32-WROOM-32 (DevKit V1) | 2 Xtensa LX6 | Compatible variant, same GPIO map |
| WT-C3 | ESP32-C3-MINI (DevKitM-1) | 1 RISC-V | Compact single-core variant, WiFi only |

---

## 2. Weight Transmitter — Core Components

### 2.1 MCU & Development Board

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | WT-S3-BOARD | ESP32-S3 DevKitC-1 | Dual-core Xtensa LX7, 240 MHz, 16MB Flash, 8MB PSRAM, native USB, WiFi/BT5 | 1 | Rp 350.000 | Rp 350.000 | Tokopedia | Primary variant |
| 2 | WT-32-BOARD | ESP32-WROOM-32 DevKit V1 | Dual-core Xtensa LX6, 240 MHz, 4MB Flash, WiFi+BT, USB Type-C | 1 | Rp 85.000 | Rp 85.000 | Shopee / Tokopedia | Alternative variant |
| 3 | WT-C3-BOARD | ESP32-C3-MINI DevKitM-1 | Single-core RISC-V, 160 MHz, 4MB Flash, WiFi only, compact | 1 | Rp 120.000 | Rp 120.000 | Tokopedia | Compact variant |
| 4 | USB-CABLE-1M | USB Data Cable Type-C 1 meter | For programming & power | 1 | Rp 25.000 | Rp 25.000 | Lokal | Required for flash & debugging |
| 5 | POWER-SUPPLY-5V-3A | Power Supply 5V 3A DC | For power ESP32 & HX711 & W5500 | 1 | Rp 45.000 | Rp 45.000 | Tokopedia | Stabilize power, prevent brown-out |

**Subtotal MCU**: **Rp 505.000** (WT-S3), **Rp 240.000** (WT-32), **Rp 275.000** (WT-C3)

### 2.2 Load Cell & ADC

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | HX711-MODULE | HX711 24-bit ADC Module | 24-bit sigma-delta, 10/80 Hz, ESD protection, screw terminal | 1 | Rp 15.000 | Rp 15.000 | Shopee / Tokopedia | Load cell ADC |
| 2 | LOADCELL-200KG | Load Cell Sensor 200kg | Strain-gauge, 4-wire Wheatstone bridge, 1-200 kg range | 1 | Rp 250.000 | Rp 250.000 | Tokopedia | Primary load cell |
| 3 | LOADCELL-500KG | Load Cell Sensor 500kg | Spare part, for maintenance/calibration | 1 | Rp 450.000 | Rp 450.000 | Tokopedia | Backup load cell |
| 4 | LOADCELL-MOUNT | Load Cell Mounting Kit | Stainless steel, for platform construction | 1 | Rp 75.000 | Rp 75.000 | Tokopedia | Mechanical mounting |

**Subtotal Load Cell**: **Rp 790.000**

### 2.3 Ethernet (W5500)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | W5500-MODULE | W5500 Ethernet Module | Hardware SPI, 10/100 Mbps, RJ45, auto MDIX | 1 | Rp 35.000 | Rp 35.000 | Shopee / Tokopedia | Modbus TCP over Ethernet |

**Subtotal Ethernet**: **Rp 35.000**

### 2.4 Display (OLED)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | SSD1306-OLED | SSD1306 128x64 OLED Module | I2C interface, 0.96 inch, blue/white | 1 | Rp 25.000 | Rp 25.000 | Shopee / Tokopedia | Weight + status display |

**Subtotal Display**: **Rp 25.000**

### 2.5 Mounting & Enclosure

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | ENCLOSURE-PROJECT | Project Box Enclosure | 150x100x70mm, IP65, ABS plastic | 1 | Rp 50.000 | Rp 50.000 | Tokopedia | Weatherproof enclosure |
| 2 | DIN-RAIL-MOUNT | DIN Rail Mount Bracket | Aluminum, kompatibel dengan ESP32 DevKit | 1 | Rp 30.000 | Rp 30.000 | Indotrading | Mounting di panel listrik/rack |
| 3 | MOUNTING-HARDWARE | Mounting Hardware Kit | M3/M4 screws, nylon standoff, untuk assemble | 1 | Rp 75.000 | Rp 75.000 | Tokopedia | Hardware untuk mounting MCU & module |
| 4 | CABLE-GLAND-PG7 | Cable Gland PG7 | Waterproof, untuk kabel masuk ke enclosure | 3 | Rp 5.000 | Rp 15.000 | Shopee | Proteksi kabel masuk ke project box |
| 5 | HEATSHRINK-5MM | Heat Shrink Tube 5mm | Assortment, untuk insulation | 1 | Rp 20.000 | Rp 20.000 | Tokopedia | Insulation koneksi |
| 6 | VELCRO-CABLE-5M | Velcro Cable Tie 5 meter | Reusable, untuk management kabel | 1 | Rp 20.000 | Rp 20.000 | Shopee | Organisasi kabel rapi |

**Subtotal Mounting**: **Rp 210.000**

---

## 3. Backend & Server Infrastructure

The Weight Transmitter acts as a **Modbus TCP server** on port 502. A backend server is required for:

1. **Data ingestion**: Read Modbus registers from multiple transmitters
2. **Business logic**: Weighing records, grading, warehouse, packaging, delivery
3. **API services**: REST API + WebSocket for dashboard
4. **Database**: PostgreSQL + TimescaleDB for time-series scale readings
5. **MQTT Broker**: Mosquitto for additional telemetry and commands

### 3.1 Server Hardware

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | MINI-PC-N100 | Mini PC Intel N100 (barebone) | Intel N100 4-core, 16GB RAM, 512GB NVMe SSD, WiFi 6, 2xLAN | 1 | Rp 4.500.000 | Rp 4.500.000 | Blibli / Tokopedia | Local server for backend + DB + MQTT |
| 2 | UPS-600VA | UPS 600VA / 360W | Pure sine wave, battery backup | 1 | Rp 850.000 | Rp 850.000 | Tokopedia | Power protection for server |

**Subtotal Server**: **Rp 5.350.000**

### 3.2 Networking

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | ROUTER-WIFI-6 | Wi-Fi 6 Router Gigabit | Dual-band AX1800, 4x LAN Gigabit, support VLAN | 1 | Rp 450.000 | Rp 450.000 | Tokopedia | Main router for local network |
| 2 | SWITCH-8PORT-GIGA | 8-Port Gigabit Unmanaged Switch | Metal casing, plug & play | 1 | Rp 365.000 | Rp 365.000 | Tokopedia | Connect all devices |
| 3 | LAN-CABLE-CAT6-305M | UTP CAT6 Cable 305 Meter | Copper, 23AWG | 1 | Rp 425.000 | Rp 425.000 | Kharisma Kencana | Main network cable |
| 4 | LAN-CABLE-PATCH-1M | LAN Cable Patch 1 meter | CAT6, finished | 5 | Rp 25.000 | Rp 125.000 | Tokopedia | Patch cables between devices |
| 5 | RACK-WALL-6U | Wall Mount Rack Cabinet 6U | 19 inch, 6U, glass door, ventilated | 1 | Rp 850.000 | Rp 850.000 | Tokopedia | Mounting server, switch |

**Subtotal Networking**: **Rp 2.215.000**

### 3.3 Software (Open Source)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | UBUNTU-SERVER-22.04 | Ubuntu Server 22.04 LTS | OS for server | 1 | Rp 0 | Rp 0 | ubuntu.com | Operating System |
| 2 | POSTGRESQL-17 | PostgreSQL 17 | Primary Database | 1 | Rp 0 | Rp 0 | postgresql.org | Business data |
| 3 | TIMESCALEDB | TimescaleDB Extension | Time-series extension | 1 | Rp 0 | Rp 0 | timescale.com | IoT readings |
| 4 | MOSQUITTO | Eclipse Mosquitto 2.x | MQTT Broker | 1 | Rp 0 | Rp 0 | mosquitto.org | IoT messaging |
| 5 | NODEJS-20 | Node.js 20 LTS | Backend runtime | 1 | Rp 0 | Rp 0 | nodejs.org | Backend runtime |
| 6 | NGINX | Nginx | Web Server / Reverse Proxy | 1 | Rp 0 | Rp 0 | nginx.com | Serve frontend + proxy API |
| 7 | DOCKER-COMPOSE | Docker & Docker Compose | Container orchestration | 1 | Rp 0 | Rp 0 | docker.com | Deploy all services |

**Subtotal Software**: **Rp 0**

---

## 4. Optional Field Devices

These are optional peripherals that integrate with the Weight Transmitter ecosystem:

### 4.1 Barcode / QR Scanners

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | SCANNER-2D-USB | Handheld Barcode Scanner 2D USB | QR Code, EAN-13, USB HID | 1 | Rp 350.000 | Rp 350.000 | Tokopedia | Optional scanner for pallet/ID scanning |
| 2 | SCANNER-OMNI-2D | Omnidirectional Desktop Barcode Scanner 2D | USB, hands-free, auto-sensing | 1 | Rp 763.500 | Rp 763.500 | Tokopedia | Optional for high-volume scanning |

**Subtotal Scanner**: **Rp 1.113.500**

### 4.2 Label Printers

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | PRINTER-LABEL-4IN | Thermal Label Printer 4 inch | Direct Thermal, 203dpi, USB+LAN | 1 | Rp 2.500.000 | Rp 2.500.000 | Tokopedia | Optional label printing |
| 2 | RIBBON-THERMAL-4IN | Thermal Transfer Ribbon 4 inch | Wax/Resin, 110mm x 300m | 3 | Rp 85.000 | Rp 255.000 | Tokopedia | Consumables |
| 3 | LABEL-PAPER-4IN | Direct Thermal Label Paper 4 inch | 100mm x 150mm, 500 pcs/roll | 5 | Rp 65.000 | Rp 325.000 | Tokopedia | Consumables |

**Subtotal Printer**: **Rp 3.080.000**

---

## 5. Consumables & Spare Parts

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | ESP32-BACKUP | ESP32 DevKit Board (backup) | Spare part if MCU fails | 1 | Rp 85.000 | Rp 85.000 | Shopee | Spare part |
| 2 | HX711-BACKUP | HX711 Module (backup) | Spare ADC module | 1 | Rp 15.000 | Rp 15.000 | Shopee | Spare part |
| 3 | W5500-BACKUP | W5500 Module (backup) | Spare Ethernet module | 1 | Rp 35.000 | Rp 35.000 | Shopee | Spare part |
| 4 | POWER-ADAPTER-5V | Power Adapter 5V 2A | Replacement power supply | 1 | Rp 35.000 | Rp 35.000 | Tokopedia | Power backup |
| 5 | CALIBRATION-WEIGHT-1KG | Calibration Weight 1kg | Calibrated iron weight | 1 | Rp 150.000 | Rp 150.000 | Tokopedia | Testing & calibration |
| 6 | CALIBRATION-WEIGHT-5KG | Calibration Weight 5kg | Calibrated iron weight | 1 | Rp 400.000 | Rp 400.000 | Tokopedia | Testing & calibration |
| 7 | MULTIMETER | Digital Multimeter | Auto-ranging | 1 | Rp 150.000 | Rp 150.000 | Shopee | Test electrical circuits |
| 8 | JUMPER-WIRE-KIT | Jumper Wire Kit | Male-to-Male & Female-to-Female, 120 pcs | 1 | Rp 35.000 | Rp 35.000 | Shopee | Prototyping & connections |

**Subtotal Consumables**: **Rp 905.000**

---

## 6. Testing & Calibration Tools

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | OSCILLOSCOPE-MINI | Mini Oscilloscope | USB, for RS485 signal test | 1 | Rp 350.000 | Rp 350.000 | Tokopedia | Debug signals |
| 2 | THERMOMETER-DIGITAL | Digital Thermometer | For temperature monitoring | 1 | Rp 50.000 | Rp 50.000 | Shopee | Environmental monitoring |
| 3 | CRIMPING-TOOL | RJ45 Crimping Tool | For LAN cable termination | 1 | Rp 50.000 | Rp 50.000 | Tokopedia | Cable maintenance |
| 4 | CABLE-TESTER | Network Cable Tester | RJ45 tester | 1 | Rp 30.000 | Rp 30.000 | Shopee | Cable maintenance |

**Subtotal Testing**: **Rp 480.000**

---

## 7. Safety & Protection

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | SURGE-PROTECTOR | Surge Protector / Power Strip | 5 outlet, surge protection | 1 | Rp 120.000 | Rp 120.000 | Tokopedia | Power protection |
| 2 | FIRST-AID-KIT | First Aid Kit | Standard | 1 | Rp 100.000 | Rp 100.000 | Shopee | Safety |
| 3 | SAFETY-GLASSES | Safety Glasses | Proteksi mata saat instalasi | 1 | Rp 25.000 | Rp 25.000 | Shopee | Safety |
| 4 | GLOVES-INSULATED | Insulated Work Gloves | Proteksi tangan saat kerja listrik | 1 | Rp 35.000 | Rp 35.000 | Tokopedia | Safety |

**Subtotal Safety**: **Rp 280.000**

---

## 8. Software Licenses & Services (Optional)

| No | Part Number | Description | Spec | Qty | Unit Price (IDR) | Total Price (IDR) | Supplier / Source | Notes |
|----|-------------|-------------|------|-----|------------------|-------------------|-------------------|-------|
| 1 | CLOUD-BACKUP | Cloud PostgreSQL (Neon / Supabase) | Managed PostgreSQL untuk backup/DR | 1 | Rp 200.000/bulan | Rp 2.400.000/tahun | neon.tech | Disaster Recovery |
| 2 | DOMAIN-NAME | Domain Name (.com / .id) | Annual fee | 1 | Rp 175.000/tahun | Rp 175.000/tahun | Niagahoster | Custom domain |
| 3 | SSL-CERTIFICATE | SSL Certificate (Let's Encrypt) | Gratis untuk 1 tahun | 1 | Rp 0 | Rp 0 | letsencrypt.org | HTTPS |
| 4 | MONITORING-UPTIME | Uptime Monitoring Service | UptimeRobot free tier | 1 | Rp 0 | Rp 0 | uptimerobot.com | Server monitoring |

**Subtotal Services (1 year)**: **Rp 2.575.000**

---

## 9. Total BOM Summary

### 9.1 Weight Transmitter — Single Unit (WT-S3 Variant)

| Category | Estimasi Minimum (IDR) | Estimasi Maksimum (IDR) | Recommended (IDR) |
|----------|------------------------|------------------------|-------------------|
| MCU & Core Components | Rp 505.000 | Rp 625.000 | Rp 550.000 |
| Load Cell & ADC | Rp 790.000 | Rp 1.240.000 | Rp 950.000 |
| Ethernet (W5500) | Rp 35.000 | Rp 35.000 | Rp 35.000 |
| Display (OLED) | Rp 25.000 | Rp 25.000 | Rp 25.000 |
| Mounting & Enclosure | Rp 210.000 | Rp 210.000 | Rp 210.000 |
| Server Infrastructure | Rp 5.350.000 | Rp 5.350.000 | Rp 5.350.000 |
| Networking | Rp 2.215.000 | Rp 2.215.000 | Rp 2.215.000 |
| Software | Rp 0 | Rp 0 | Rp 0 |
| Consumables & Spare Parts | Rp 905.000 | Rp 905.000 | Rp 905.000 |
| Testing & Calibration | Rp 480.000 | Rp 480.000 | Rp 480.000 |
| Safety & Protection | Rp 280.000 | Rp 280.000 | Rp 280.000 |
| Optional Field Devices | Rp 0 | Rp 4.193.500 | Rp 1.500.000 |
| Software Services (1 year) | Rp 575.000 | Rp 4.000.000 | Rp 2.000.000 |
| **TOTAL** | **Rp 11.395.000** | **Rp 19.558.500** | **Rp 14.500.000** |

### 9.2 Weight Transmitter — Single Unit (WT-32 Variant)

| Category | Estimasi Minimum (IDR) | Estimasi Maksimum (IDR) | Recommended (IDR) |
|----------|------------------------|------------------------|-------------------|
| MCU & Core Components | Rp 240.000 | Rp 240.000 | Rp 240.000 |
| Load Cell & ADC | Rp 790.000 | Rp 1.240.000 | Rp 950.000 |
| Ethernet (W5500) | Rp 35.000 | Rp 35.000 | Rp 35.000 |
| Display (OLED) | Rp 25.000 | Rp 25.000 | Rp 25.000 |
| Mounting & Enclosure | Rp 210.000 | Rp 210.000 | Rp 210.000 |
| **SUBTOTAL TRANSMITTER** | **Rp 1.300.000** | **Rp 1.750.000** | **Rp 1.460.000** |

---

## 10. Quantity Scaling

### 10.1 Multi-Unit Deployment

| Units | WT-S3 Total (IDR) | WT-32 Total (IDR) | Notes |
|-------|-------------------|-------------------|-------|
| 1 unit | Rp 11.395.000 | Rp 9.845.000 | Single transmitter |
| 2 units | Rp 17.145.000 | Rp 15.595.000 | 2 transmitters + shared server |
| 3 units | Rp 22.895.000 | Rp 21.345.000 | 3 transmitters + shared server |
| 5 units | Rp 34.395.000 | Rp 32.845.000 | 5 transmitters + shared server |

> **Note**: Server infrastructure (Mini PC + networking) is shared across all units in the same location. Only MCU, load cell, and mounting components scale per unit.

---

## 11. Key Differences from Previous BOM

| Aspect | Previous BOM (v1.0) | Updated BOM (v2.0) |
|--------|---------------------|---------------------|
| **Product Focus** | Generic E-Tani Smart Hub system | Specific Weight Transmitter Multi-Core |
| **MCU Architecture** | 3x ESP32 for different areas | Single transmitter per unit, variants: S3/32/C3 |
| **Communication** | MQTT + RS485 scales | Modbus TCP primary (WiFi + Ethernet) |
| **Scale Interface** | External RS485 scales | Integrated HX711 load cell |
| **Ethernet** | Not specified | W5500 for Modbus TCP |
| **Display** | Not specified | SSD1306 OLED for weight + status |
| **Web Interface** | Separate backend system | Built-in captive portal (Soft-AP only) |
| **Calibration** | Not specified | Multi-point calibration with NVS persistence |
| **Firmware** | Generic IoT | Multi-core FreeRTOS with SharedState IPC |

---

## 12. Catatan Penting

### 12.1 Variant Selection Guide

| Use Case | Recommended Variant | Reason |
|----------|---------------------|--------|
| New deployment, maximum performance | WT-S3 | Dual-core, native USB, more RAM/Flash |
| Cost-sensitive deployment | WT-32 | Lower cost, same GPIO map, proven stability |
| Compact/embedded deployment | WT-C3 | Smallest footprint, single-core sufficient for basic weighing |

### 12.2 Load Cell Selection

- **200 kg load cell**: Suitable for most potato/agricultural weighing applications
- **500 kg load cell**: Backup/spare for heavy-duty applications
- Calibration weights required: 1 kg (for tare), 5 kg (for calibration reference)

### 12.3 Compliance & Standards

- **Modbus TCP**: Standard port 502, big-endian float encoding
- **MQTT QoS**: Scale readings QoS 1 (at least once); commands QoS 0 (at most once)
- **GS1 Compliance**: Label formats follow GS1 standards (if optional printers used)
- **Electrical**: 5V/3A power supply recommended for stability with Ethernet + WiFi + OLED active

### 12.4 Scaling Considerations

- Each additional Weight Transmitter unit requires: MCU + Load Cell + Ethernet + Display + Mounting
- Server infrastructure (Mini PC + networking) is shared across all units at the same location
- For multi-location deployment, each location needs its own server infrastructure
- Backend can handle 10-50 transmitters per server depending on polling frequency

---

## 13. Referensi Harga

| Sumber | URL | Diakses |
|--------|-----|---------|
| Shopee Indonesia | https://shopee.co.id | 2026-09-30 |
| Tokopedia | https://www.tokopedia.com | 2026-09-30 |
| Blueprint Indonesia | https://www.blueprint-indonesia.com | 2026-09-30 |
| Indotrading | https://www.indotrading.com | 2026-09-30 |
| Kharisma Kencana | https://kharismakencana.com | 2026-09-30 |
| Bhinneka | https://www.bhinneka.com | 2026-09-30 |
| JakartaNotebook | https://www.jakartanotebook.com | 2026-09-30 |

---

## 14. Approval & Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-09-15 | Kilo Agent | Initial BOM creation based on generic system architecture |
| 2.0 | 2026-09-30 | Kilo Agent | Updated to reflect Weight Transmitter Multi-Core firmware, restructured product line, added variants, updated pricing |

---

**End of Document**
