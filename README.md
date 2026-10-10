# 🌾 ENYX-Smart Hub

**The complete harvest-to-shipment operating system for modern agriculture.**

Digitize your entire harvest chain — from farmer delivery to export-ready packaging — with IoT integration, real-time traceability, and GS1-standard barcodes. Built for potatoes today — multi-commodity-ready for tomatoes, chilies, and beyond.

---

## ⚡ What It Does

ENYX-Smart Hub transforms traditional agricultural packaging and warehouse operations into a fully digital, traceable, and efficient workflow:

| Stage | What Happens | Tech |
|-------|--------------|------|
| 🚚 **Receive** | Farmer arrives → scan ID → weigh & approve → weigh pallet | MQTT + RS485 Scales |
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

- Node.js 20 LTS
- Docker & Docker Compose
- PostgreSQL 17 (or use Docker)
- Mosquitto 2.x MQTT Broker (or use Docker)
- Redis (or use Docker)

### One-Command Setup

```bash
# Start infrastructure
docker-compose up -d postgres mosquitto redis

# Install backend
cd backend && npm install

# Configure environment
cp .env.example .env

# Initialize database
npm run prisma:migrate && npm run prisma:seed

# Start development
npm run dev
```

```bash
# Install frontend
cd frontend && npm install && npm run dev
```

🌐 Open http://localhost:5173 (frontend) and http://localhost:3000/api/docs (API)

---

## 🏗️ Architecture

**Modular Monolith** — Single-server deployment with 8 business modules + shared infrastructure. Easy to deploy, easy to scale later.

```
backend/src/
├── modules/          # Business logic
│   ├── auth/         # JWT + RBAC (6 roles)
│   ├── farmers/      # Farmer profiles & codes
│   ├── pallets/      # Pallet management
│   ├── weighing/     # IoT scale integration + grading
│   ├── warehouse/    # Stock in/out + capacity tracking
│   ├── labels/       # QR, EAN-13, ITF-14 generation
│   ├── packaging/    # Bundle pouches into cartons/pallets
│   └── deliveries/   # Truck dispatch + verification
├── shared/           # Cross-cutting infrastructure
│   ├── mqtt/         # Mosquitto client (real-time IoT)
│   ├── socket/       # Socket.io (live dashboard)
│   ├── barcode/      # GS1 barcode utilities
│   └── database/     # Prisma + TimescaleDB
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
│  🥔 Commodity: Kentang (fixed)                             │
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
| RS485 Weighing Scales | MQTT (QoS 1) | Auto-record weights with timestamp |
| QR/Barcode Scanners | USB/LAN → MQTT | Instant ID verification |
| Label Printers | MQTT Commands | Auto-print QR/EAN-13/ITF-14 |
| Smartphones | HTTPS + Socket.io | Farmer traceability + driver dispatch |

**MQTT Topics** (Kentang sekarang; multi-commodity-ready):

```
enyx/kentang/penerimaan/scale/big    → Weighing
enyx/kentang/sortir/scale/grade-a    → Grading
enyx/warehouse/scan/in                 → Stock In
enyx/warehouse/scan/out                → Stock Out
enyx/kentang/pengemasan/print          → Labels
enyx/delivery/truck/status             → Delivery
```

*Segment `kentang` akan menjadi placeholder `<commodity>` saat multi-commodity diaktifkan.*

---

## 🥔 Kentang Dulu, Multi-Commodity Nanti

Sistem ini saat ini beroperasi untuk **satu komoditas: Kentang**, dengan arsitektur yang sudah multi-commodity-ready:

- **Per-grade tracking** — Kentang Grade A/B/C
- **Per-grade packaging** — berbagai ukuran box dan barcode
- **Real-time warehouse stock** — per grade
- **Delivery logs** — dokumentasi ekspor per pengiriman

Menambah commodity baru di masa depan (Tomat, Cabai, dll.) hanya memerlukan data master — tanpa migrasi skema.

---

## 🔐 Role-Based Access Control

| Role | Access |
|------|--------|
| `ADMIN` | Full system configuration + user management |
| `WEIGHING_OPERATOR` | Scan IDs, verify scales, create pallets, input weights |
| `SORTING_OPERATOR` | Grade produce, create pouches, print labels |
| `WAREHOUSE_OPERATOR` | Stock in/out, capacity monitoring, inventory |
| `DELIVERY_OPERATOR` | Package cartons, verify shipments, dispatch trucks |
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
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 17 + TimescaleDB (time-series) |
| Cache | Redis (session context) |
| IoT Broker | Mosquitto 2.x (MQTT) |
| Real-time | Socket.io |
| Barcode | bwip-js (GS1 standards) |
| Frontend | React + Vite |
| DevOps | Docker Compose |

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
npm run test:unit

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
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
