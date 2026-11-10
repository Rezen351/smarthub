# 🌾 ENYX-Smart Hub

**The complete harvest-to-shipment operating system for modern agriculture.**

Digitize your entire harvest chain — from farmer delivery to export-ready packaging — with IoT integration, real-time traceability, and GS1-standard barcodes. Built for potatoes today — multi-commodity-ready for tomatoes, chilies, and beyond.

---

## ⚡ What It Does

ENYX-Smart Hub transforms traditional agricultural packaging and warehouse operations into a fully digital, traceable, and efficient workflow:

| Stage | What Happens | Tech |
|-------|--------------|------|
| 🚚 **Receive** | Farmer arrives → scan ID → weigh & approve → weigh pallet | Modbus TCP + RS485 Scales |
| 🧼 **Process** | Wash/dry (optional) → grade sorting → re-weighing per grade | IoT Edge Devices |
| 📦 **Package** | 1 kg pouches → QR + EAN-13 labels → carton bundling → ITF-14 | GS1 Barcodes |
| 🚛 **Deliver & Trace** | Truck loading → barcode verification → end-to-end traceability | Real-time Dashboard |

---

## 🎯 Why ENYX-Smart Hub?

**For Farmers**: Prove your harvest origin, quality, and quantity with digital traceability.  
**For Operators**: Reduce manual input with smart context auto-fill — scan once, fill everything else automatically.  
**For Warehouse**: Real-time stock visibility per grade, with capacity alerts.  
**For Export**: GS1-standard barcodes (QR, EAN-13, ITF-14) ready for international retail and logistics.  
**For Admins**: Complete control with role-based access, analytics, and multi-commodity-ready architecture.

---

## 🚀 Quick Start

### Prerequisites

- Go 1.23+
- Docker & Docker Compose
- PostgreSQL 17 (or use Docker)
- Scale simulator for development or physical Modbus TCP scales

### One-Command Setup

```bash
# Start infrastructure
docker-compose up -d postgres scale-simulator
docker-compose run --rm db-migrate
docker-compose up -d backend
```

```bash
# Install frontend
cd frontend && npm install && npm run dev
```

🌐 Open http://localhost:5173 (frontend) and http://localhost:3000/health (API)

---

## 🏗️ Architecture

**Modular Monolith** — Single-server deployment with 8 business modules + shared infrastructure. Easy to deploy, easy to scale later.

```
backend/
├── cmd/server/       # Go API and migration entrypoint
├── internal/db/      # PostgreSQL migration runner
├── internal/httpapi/ # REST handlers
└── migrations/       # Versioned SQL migrations
```

---

## 🔄 How It Works: The Smart Context Flow

**Traditional way**: Operator manually enters farmer, pallet, grade, weight — 4+ fields, prone to errors.  
**ENYX way**: Scan once → everything else auto-fills.

```
┌─────────────────────────────────────────────────────────────┐
│  Operator Dashboard                                         │
├─────────────────────────────────────────────────────────────┤
│  Current Context:                                           │
│  👤 Farmer: Ahmad Santoso (FRM-2026-0001)                  │
│  🥔 Commodity: Potatoes (fixed)                            │
│  📦 Pallet: PLT-20260914-0001                              │
│  [Reset Context]                                            │
├─────────────────────────────────────────────────────────────┤
│  [Timbang]  [Sortir]  [Pack]  [Warehouse]  [Delivery]      │
│                                                             │
│  → When [Timbang]: only enter WEIGHT                       │
│  → When [Sortir]: only select GRADE + enter WEIGHT         │
│  → Commodity, farmer, pallet → AUTO-FILLED                 │
└─────────────────────────────────────────────────────────────┘
```

**Benefits**:
- ⚡ **3x faster** operations — minimal input
- ✅ **Zero manual errors** — commodity auto-filled from context
- 🔄 **Persistent session** — 4-hour TTL, auto-renewed
- 🔁 **Multi-commodity-ready** — context & schema siap tambah komoditas tanpa refactor

---

## 📡 IoT Integration

Real-time data from your field to your dashboard:

| Device | Protocol | What It Does |
|--------|----------|--------------|
| Weighing Scales | Modbus TCP over Ethernet | Live weight readings |
| QR/Barcode Scanners | USB/LAN | Instant ID verification |
| Thermal Printers | Ethernet | Two 80 mm IW-J300H printers for Reception and Packaging |
| Smartphones | HTTPS + Socket.io | Farmer traceability + driver dispatch |

---

## 🥔 Potatoes First, Multi-Commodity Later

Sistem ini saat ini beroperasi untuk **satu komoditas: Potatoes**, dengan arsitektur yang sudah multi-commodity-ready:

- **Per-grade tracking** — Potatoes Grade A/B/C
- **Per-grade packaging** — berbagai ukuran box dan barcode
- **Real-time warehouse stock** — per grade
- **Delivery logs** — dokumentasi ekspor per pengiriman

Menambah commodity baru di masa depan (Tomat, Cabai, dll.) hanya memerlukan data master — tanpa migrasi skema.

---

## 🔐 Role-Based Access Control

| Role | Access |
|------|--------|
| `ADMIN` | Full system configuration + user management |
| `WEIGHING_OPERATOR` | Scan farmer IDs, pure intake weighing, approve weights, print pallet labels |
| `SORTING_OPERATOR` | Grade produce, print pallet grading labels |
| `PACKAGING_OPERATOR` | 1 kg pouch packaging, live scale approval, label printing |
| `WAREHOUSE_OPERATOR` | Stock in/out, capacity monitoring, inventory |
| `DELIVERY_OPERATOR` | Verify shipments, dispatch trucks |
| `FARMER` | View personal harvest history + traceability |

---

## 🧪 Barcode Standards We Support

| Label | Type | Standard | Used For |
|-------|------|----------|----------|
| Pouch 1 kg | QR Code | Internal | Farmer, location, date, grade, weight |
| Pouch 1 kg | EAN-13 | GS1 Retail | Retail/export product ID (`899` + commodity) |
| Carton 10/50 kg | ITF-14 | GS1 Logistics | Shipping unit, batch, net/gross weight |
| Farmer ID | QR Code | Internal | Instant farmer verification |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go REST API |
| Database | PostgreSQL 17 |
| Scale Transport | Modbus TCP over Ethernet |
| Thermal Printers | Two IW-J300H units, 80 mm, Ethernet |
| Barcode | Offline QR and GS1-compatible generators |
| Frontend | React + Vite |
| DevOps | Docker Compose |

### Runtime Configuration Ownership

Operational hardware values are backend-owned and exposed through the API:

- Scale host, port, capacity, Online/Offline status, and live weight come from the Go backend and Modbus connection.
- Reception and Packaging printer addresses, ports, and Online/Offline status come from PostgreSQL-backed printer settings.
- Thermal receipts and labels are sent by the Go backend to the configured station printer; operational printing does not use the browser print dialog.
- Scale host, port, and capacity are stored in the database and edited through Settings; simulator ports are fixed test fixtures.
- UI labels, station names, barcode formats, and the mandated IW-J300H 80 mm format are fixed product constants.

Frontend pages must not define physical IP addresses, operational ports, capacities, live weights, or device status as fallback values.

---

## 📚 Documentation

- `docs/DIAGRAM.md` — Workflow diagrams + database ERD (sumber visual utama)
- `docs/laporan.tex` — Laporan resmi sistem (konsolidasi rancangan: arsitektur, tech stack, API, BOM, UI/UX, rencana implementasi)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
cd backend && go test ./...
```

---

## 📝 License

Proprietary — ENYX-Smart Hub

---

## 🐛 Known Issues

See [logs.md](logs.md) for daily activity logs and technical decisions.

---

## 🤝 Contributing

This is a proprietary system. For feature requests or bug reports, contact the development team.

---

**Built with ❤️ for farmers, operators, and the future of smart agriculture.**
