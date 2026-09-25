# 🏗️ Recommended Tech Stack — ENYX-Smart Hub

Berdasarkan arsitektur 5-layer di [`docs/output_diagram.md`](docs/output_diagram.md), berikut rekomendasi tech stack yang disesuaikan dengan skala proyek, kebutuhan IoT, warehouse management, dan traceability.

---

## 🎯 Ringkasan Rekomendasi

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Edge / MCU | ESP32 + PlatformIO | WiFi + MQTT native, RS485 via shield, hemat biaya |
| MQTT Broker | Eclipse Mosquitto | Ringan, stabil untuk LAN, cocok untuk skala menengah |
| Backend | Node.js + Express + TypeScript | Ekosistem MQTT kuat, real-time mudah, cocok untuk WMS |
| Database | PostgreSQL 17 + TimescaleDB | Relasional untuk bisnis + time-series untuk IoT dalam satu DB |
| Frontend | React + TypeScript + Vite | Modern, cepat, banyak talenta,生态 Vue/React stabil |
| UI Framework | Tailwind CSS + shadcn/ui | Konsisten, customizable, development cepat |
| Real-time | Socket.io | WebSocket + fallback otomatis untuk update dashboard live |
| Auth | JWT + RBAC middleware | Stateless, cocok untuk API + 3 role (Admin/Operator/Farmer) |
| Barcode/QR | bwip-js (backend) + html5-qrcode (frontend) | Support EAN-13, ITF-14, QR Code sesuai standar GS1 |
| Cloud/Backup | Neon / Supabase PostgreSQL | Managed PostgreSQL untuk backup/DR tanpa ribet |
| Infra | Docker Compose + Nginx + Let's Encrypt | Deployable di satu PC server, HTTPS ready |

---

## 📡 Layer 1 — Field Level & Edge

### Perangkat Lapangan
- **Timbangan RS485**: Pertahankan perangkat yang sudah ada. Pastikan output RS485 terhubung ke **MAX485 TTL converter** sebelum masuk ke MCU.
- **Scanner QR**: Gunakan scanner USB barcode yang dapat mengirimkan data sebagai keyboard input, atau scanner serial (RS232/USB) dengan SDK khusus.
- **Printer Label**: Dapat menggunakan printer thermal USB/LAN dengan driver untuk cetak QR/EAN-ITF. Generate label dari backend, cetak via web app.
- **Smartphone Petani & Driver**: Akses via mobile browser (PWA), tidak perlu aplikasi native khusus.

### Mikrokontroler (MCU)
- **ESP32** (recommended) atau **ESP8266**
  - Built-in WiFi, MQTT client library (PubSubClient)
  - Tambah **RS485 shield/module** (MAX485) untuk membaca timbangan
  - Firmware: Arduino C++ atau MicroPython
  - Topik MQTT contoh: `enyx/area/penerimaan/scale`, `enyx/area/sortir/scale-a`
- **Raspberry Pi Zero 2 W** (alternatif untuk edge gateway lebih kuat)
  - Bisa menjalankan MQTT client + preprocessing data sebelum publish

### Router/Switch
- Router LAN/WiFi standar yang mendukung VLAN untuk isolasi IoT traffic
- Pastikan PC server dan MCU dalam network yang sama

---

## 🔄 Layer 2 — MQTT & Messaging

### MQTT Broker
- **Eclipse Mosquitto 2.x** (self-hosted di PC server)
  - Ringan, stabil, support QoS 0/1/2
  - Konfigurasi: allow_anonymous false, password file untuk device auth
  - Port: 1883 (TCP), 9001 (WebSocket jika diperlukan)
- **Alternatif managed**: HiveMQ Cloud / AWS IoT Core (jika ingin cloud-first)

### Topik MQTT Convention
```
enyx/<area>/<tipe_data>[/<device_id>]

Contoh:
 - enyx/penerimaan/scale/big       → timbangan besar area penerimaan
 - enyx/sortir/scale/grade-a       → timbangan grade A
 - enyx/pengemasan/print           → trigger print label
 - enyx/warehouse/scan/in          → scan masuk warehouse
 - enyx/warehouse/scan/out         → scan keluar warehouse + verify ITF-14
 - enyx/delivery/truck/status      → status truck keberangkatan
```

### MQTT Client Library (Backend)
- **Node.js**: `mqtt` (MQTT.js) — mature, well-documented
- **Python**: `paho-mqtt` — alternatif jika backend menggunakan Python

---

## 🖥️ Layer 3 — Application Level (Local PC Server)

### Web Server
- **Nginx** sebagai reverse proxy
  - Serve static frontend (React build)
  - Proxy API ke backend (`/api/*`)
  - SSL termination dengan Let's Encrypt
  - WebSocket proxy untuk Socket.io

### Backend Application
**Pilihan 1 (Recommended untuk proyek ini): Node.js + Express + TypeScript**
- **Express 5** — web framework, middleware besar
- **TypeScript** — type safety untuk data IoT yang kompleks
- **mqtt.js** — MQTT client untuk subscribe/publish
- **Socket.io** — real-time push ke dashboard
- **Prisma** — ORM untuk PostgreSQL, type-safe queries
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT untuk auth
- **zod** — input validation
- **winston** — structured logging

### Database
**PostgreSQL 17 + TimescaleDB** (recommended)
- **PostgreSQL** untuk data bisnis: farmers, pallets, grades, warehouse, deliveries, users
- **TimescaleDB** (extension PostgreSQL) untuk time-series data: readings timbangan, sensor logs
- Keunggulan: satu database, query SQL standar, time-series optimization otomatis

**Skema data inti:**
```sql
-- Business tables
farmers (id, name, location, created_at)
pallets (id, farmer_id, code, created_at)
grades (id, name, description)
weighing_records (id, pallet_id, grade_id, weight_kg, recorded_at)
pouches (id, pallet_id, grade_id, qr_code, ean13, created_at)
warehouse_stock (id, grade_id, quantity, total_weight_kg, capacity)
packaging_units (id, size_id, barcode, batch_no, total_weight, commodity_id, status)
packaging_items (id, packaging_id, item_id, item_type)
deliveries (id, truck_plate, destination, commodity_id, departed_at)

-- Time-series (TimescaleDB hypertable)
scale_readings (time, device_id, weight_kg, pallet_id, raw_payload)
```

**Alternatif**: PostgreSQL saja tanpa TimescaleDB jika data IoT tidak terlalu tinggi frequency.

### API Response Format (sesuai AGENTS.md)
```json
{
  "success": true,
  "data": { ... }
}
```
atau
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid farmer ID"
  }
}
```

---

## ☁️ Layer 4 — Cloud Level

### Cloud Database (Backup / DR)
- **Neon** (serverless PostgreSQL) atau **Supabase** (PostgreSQL + Auth + Realtime)
  - Managed PostgreSQL untuk backup berkala
  - Auto-backup daily, point-in-time recovery
  - Bisa juga di-deploy di VPS sendiri (DigitalOcean, Hetzner)

### Strategi Sinkronisasi
- **Cron job** di backend yang menjalankan `pg_dump` atau logical replication ke cloud DB setiap 1-6 jam
- Atau gunakan **pglogical** untuk real-time replication
- Data yang di-sync: farmers, pallets, weighing_records, warehouse_stock, deliveries
- Data time-series mentah bisa di-agregasi terlebih dahulu sebelum sync untuk hemat bandwidth

---

## 🌐 Layer 5 — Enterprise Level

### Domain & HTTPS
- **Cloudflare** untuk DNS + DDoS protection + CDN
- **Let's Encrypt (certbot)** untuk SSL certificate gratis
- Nginx reverse proxy ke backend

### Frontend Application
**React + TypeScript + Vite**
- **React 19** — UI framework
- **TypeScript** — type safety
- **Vite** — build tool, HMR cepat
- **Tailwind CSS v4** — utility-first CSS
- **shadcn/ui** — komponen UI modern (berbasis Radix UI)
- **React Router v7** — routing
- **Recharts** — chart untuk analytics warehouse, weighing trends
- **Socket.io Client** — real-time updates dari backend
- **Axios** — HTTP client dengan interceptor JWT
- **Lucide React** — icons
- **html5-qrcode** — scanning QR/EAN dari browser (untuk operator)
- **qrcode.react + bwip-js** — generate QR/EAN-ITF label (untuk admin/operator)

### Mobile Experience
- **PWA (Progressive Web App)** — installable di homescreen, offline capable
- Responsive design dengan Tailwind untuk layar kecil
- Kamera akses untuk scanning barcode via web

### RBAC (Role-Based Access Control)
| Role | Hak Akses |
|------|-----------|
| **Admin** | Full access — config, reports, user management, semua operasi |
| **Weighing Operator** | Operasional penimbangan — scan ID, verifikasi timbangan, input berat, create pallet |
| **Sorting Operator** | Operasional penyortiran — grading, buat pouch, cetak label |
| **Warehouse Operator** | Operasional gudang — warehouse in/out, stok management |
| **Delivery Operator** | Operasional pengiriman — packaging, delivery, cetak dokumen |
| **Farmer** | Traceability — riwayat setoran, data grade per-paletan, info panen |

Implementasi: JWT token dengan `role` claim, middleware verifikasi di setiap endpoint.

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                    PC Server (Local)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Mosquitto│  │ Backend  │  │ PostgreSQL       │  │
│  │ :1883    │  │ :3000    │  │ + TimescaleDB    │  │
│  └──────────┘  └──────────┘  │ :5432            │  │
│       ▲           ▲           └──────────────────┘  │
│       │           │                  ▲                │
│  ┌────┴────┐      │                  │                │
│  │ MCU 1   │      │                  │                │
│  │ ESP32   │      │                  │                │
│  └─────────┘      │                  │                │
│  ┌─────────┐      │                  │                │
│  │ MCU 2   │      │                  │                │
│  │ ESP32   │      │                  │                │
│  └─────────┘      │                  │                │
│                    │                  │                │
│  ┌─────────────────┴──────────────────┴─────────────┐ │
│  │ Nginx (Reverse Proxy + SSL)                       │ │
│  │ - Serve React build                               │ │
│  │ - Proxy /api → backend :3000                      │ │
│  │ - Proxy /mqtt → Mosquitto (WebSocket)             │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                    HTTPS (443)
                         │
                         ▼
              ┌──────────────────────┐
              │   Internet / Cloud   │
              │   - Cloudflare DNS   │
              │   - Let's Encrypt    │
              │   - Neon/Supabase    │
              │     (Cloud DB)       │
              └──────────────────────┘
                         │
                    HTTPS (443)
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────┴────┐           ┌────┴────┐
         │ Admin   │           │ Farmer  │
         │ (Laptop)│           │ (Mobile)│
         └─────────┘           └─────────┘
```

---

## 📦 Tech Stack Detail

### Backend Stack
| Teknologi | Fungsi | Alasan |
|-----------|--------|--------|
| Node.js 20 LTS | Runtime | Stable, MQTT ecosystem kuat |
| Express 5 | Web Framework | Minimalist, middleware fleksibel |
| TypeScript | Language | Type safety untuk data IoT kompleks |
| Prisma 7 | ORM | Type-safe queries, migration management |
| mqtt.js | MQTT Client | Standard untuk Node.js, support QoS |
| Socket.io 4 | Real-time | WebSocket + HTTP fallback, rooms/events |
| jsonwebtoken + bcryptjs | Auth | JWT stateless, RBAC |
| zod | Validation | Runtime schema validation |
| winston | Logging | Structured logging dengan levels |

### Database Stack
| Teknologi | Fungsi | Alasan |
|-----------|--------|--------|
| PostgreSQL 17 | Primary DB | ACID, relational untuk bisnis |
| TimescaleDB | Time-series extension | Optimized untuk IoT readings, auto-partitioning |
| pgvector (opsional) | Vector search | Jika nanti perlu similarity search untuk produk |

### Frontend Stack
| Teknologi | Fungsi | Alasan |
|-----------|--------|--------|
| React 19 | UI Framework | Hooks, concurrent features, large ecosystem |
| TypeScript | Language | Type safety |
| Vite 8 | Build Tool | HMR super fast, modern |
| Tailwind CSS v4 | Styling | Utility-first, consistent design system |
| shadcn/ui | Components | Accessible, customizable, Radix-based |
| React Router v7 | Routing | Data routers, protected routes |
| Recharts 3 | Charts | Time-series, warehouse visualization |
| Socket.io Client | Real-time | Live scale readings, alerts |
| Axios | HTTP Client | Interceptors, JWT handling |
| html5-qrcode | Scanner | QR + EAN scanning dari browser |
| qrcode.react + bwip-js | Generator | QR Code + GS1 Barcode generation |
| Lucide React | Icons | Consistent icon set |

### Infrastructure Stack
| Teknologi | Fungsi | Alasan |
|-----------|--------|--------|
| Docker Compose | Orchestration | Deploy semua service dalam satu command |
| Nginx | Reverse Proxy | SSL, static files, WebSocket proxy |
| Let's Encrypt | SSL | Free automated certificates |
| Cloudflare | DNS + CDN | Fast DNS, DDoS protection, free tier |
| Neon / Supabase | Cloud DB | Managed PostgreSQL untuk backup/DR |

---

## 🔧 Contoh File Structure

```
enyx-smart-hub/
├── firmware/
│   ├── mcu1-penerimaan/       # ESP32 Arduino sketch (scale + scanner)
│   └── mcu2-sortir/           # ESP32 Arduino sketch (scale A/B/C)
├── backend/
│   ├── src/
│   │   ├── config/            # env, database, mqtt, swagger/rapidoc
│   │   ├── controllers/       # auth, weighing, warehouse, delivery, label
│   │   ├── middlewares/        # auth, errorHandler, rbac, validate
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # mqttHandler, socketService, syncService
│   │   ├── models/            # Prisma models (schema.prisma)
│   │   ├── types/             # TypeScript interfaces
│   │   └── index.ts           # Express app + Socket.io + graceful shutdown
│   ├── prisma/
│   │   └── schema.prisma      # DB schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # ui, dashboard, warehouse, delivery, label
│   │   ├── pages/             # Login, Dashboard, Warehouse, Delivery, Reports
│   │   ├── contexts/          # AuthContext, SocketContext
│   │   ├── hooks/             # useMQTT, useRealTime, useScan
│   │   ├── services/          # api, socket
│   │   ├── types/             # TypeScript interfaces
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml
├── nginx/
│   └── default.conf
├── .env.example
└── README.md
```

---

## ✅ Mengapa Stack Ini Cocok?

1. **Single local server**: Semua service (backend, DB, MQTT, web) bisa jalan di satu PC server di lokasi — sesuai diagram yang ada.
2. **Local-first dengan cloud backup**: Data utama tersimpan lokal (cepat, tidak bergantung internet), backup ke cloud secara periodic.
3. **MQTT-native**: Stack didesain untuk IoT real-time, cocok untuk timbangan dan scanner yang butuh update cepat.
4. **Barcode/QR compliant**: Library yang dipilih support EAN-13, ITF-14, QR Code sesuai standar GS1 di diagram.
5. **RBAC built-in**: JWT + middleware RBAC untuk 3 role (Admin/Operator/Farmer).
6. **Scalable**: Jika nanti perlu scale, bisa pisah service atau pindah ke cloud tanpa rewrite.
7. **Cost-effective**: Stack ini bisa jalan di PC server lama + cloud free tier untuk backup.

---

## 🚦 Next Steps

1. **Pilih backend language** (Node.js vs Python vs Go) — Node.js recommended untuk ecosystem MQTT + real-time yang matang.
2. **Setup database schema** untuk farmers, pallets, grades, weighing, warehouse, deliveries.
3. **Develop ESP32 firmware** untuk MCU 1 (penerimaan) dan MCU 2 (sortir).
4. **Build backend API** dengan MQTT integration.
5. **Build frontend dashboard** dengan role-based views.
6. **Implement barcode generation** untuk pouch (QR + EAN-13) dan packaging (ITF-14).
7. **Setup cloud backup** untuk disaster recovery.

---

## 📚 Related Documentation

- `API.md` — Complete API endpoint registry with OpenAPI/Swagger documentation
- `ARCHITECTURE.md` — Module architecture and responsibilities
- `PLANNING.md` — Implementation phases and task breakdown
- `DIAGRAM.md` — Architecture diagrams and database ERD
