# 🏗️ Architecture — Modul & Shared Components

Dokumen ini menjelaskan fungsi setiap modul dan shared component dalam arsitektur **modular monolith** untuk ENYX-Smart Hub. Setiap modul memiliki tanggung jawab yang jelas dan terisolasi, sehingga mudah diuji, dirawat, dan nanti bisa diextract menjadi microservice jika diperlukan.

---

## 📦 Overview Arsitektur

```
backend/src/
├── modules/          # Business logic modules (domain-driven)
│   ├── auth/         # Authentication & RBAC
│   ├── farmers/      # Farmer management
│   ├── pallets/      # Pallet management
│   ├── weighing/     # Weighing & grading
│   ├── warehouse/    # Warehouse stock management
│   ├── labels/       # Barcode/QR generation
│   ├── packaging/     # Packaging & bundling
│   └── deliveries/   # Delivery management
├── shared/           # Shared infrastructure (cross-cutting)
│   ├── mqtt/         # MQTT client
│   ├── socket/       # Socket.io
│   ├── barcode/      # Barcode utilities
│   └── database/     # Prisma client
├── config/           # Configuration
├── middlewares/      # Express middlewares
├── routes/           # Route definitions
├── controllers/      # Thin controllers
├── types/            # TypeScript types
└── index.ts          # App entry point
```

---

## 🎯 Modul Utama (`modules/`)

Setiap modul mengikuti struktur:
```
modules/<nama-modul>/
├── <nama-modul>.service.ts      # Business logic
├── <nama-modul>.controller.ts   # HTTP handlers (thin)
├── <nama-modul>.routes.ts       # Route definitions
├── <nama-modul>.schema.ts       # Zod validation schemas
├── <nama-modul>.types.ts        # Module-specific types
└── index.ts                     # Public API module
```

---

## 🔄 Session Context & Auto-Fill (Minimize Operator Input)

**Fungsi**: Mengurangi input manual operator dengan menyimpan dan mengisi ulang context secara otomatis berdasarkan scan pertama dan pilihan komoditas.

**Konsep**: Setelah operator melakukan scan pertama (pallet ID atau farmer ID) dan memilih commodity, sistem menyimpan context dalam session aktif. Semua input berikutnya hanya membutuhkan data yang berubah (misal: berat), sementara data lain (farmer, commodity, grade) otomatis terisi dari context.

**Context yang disimpan**:
- `farmerId` — ID petani dari scan pertama
- `farmerName` — Nama petani
- `commodityId` — **Komoditas yang dipilih operator saat penimbangan pertama**
- `commodityName` — Nama komoditas (Kentang, Tomat, Cabai)
- `palletId` — ID palet dari scan pertama
- `palletCode` — Kode palet
- `defaultGradeId` — Grade default untuk commodity (jika ada)
- `location` — Lokasi kebun farmer

**Storage & Lifecycle**:
- **Storage**: Redis (key: `ctx:{userId}`, TTL: 4 jam)
- **TTL**: 4 jam dari aktivitas terakhir, diperpanjang setiap request
- **Expiry**: Jika context expired, operator harus scan ulang + pilih commodity
- **Multi-device**: Satu user login di satu device; session context per user, bukan per device
- **Reset**: Manual via `POST /api/context/reset` atau saat operator scan ID baru

**Cara Kerja**:
1. **First Scan + Commodity Selection**: Operator scan pallet ID atau farmer ID, kemudian **memilih commodity** yang ditimbang
   - Sistem lookup: farmer + pallet
   - Operator pilih commodity dari list
   - Simpan ke session context
   - Tampilkan ringkasan: "Farmer: Ahmad, Commodity: Kentang, Pallet: PLT-001"

2. **Subsequent Inputs**: Operator hanya input yang berubah
   - **Weighing**: Input berat saja → commodity, farmer, pallet auto-fill
   - **Sortir/Grade**: Pilih grade + input berat → commodity auto-fill
   - **Packaging**: Pilih packaging type → commodity auto-fill
   - **Warehouse In**: Scan pouch/pallet → commodity, grade auto-fill
   - **Delivery**: Pilih packaging → commodity auto-fill

3. **Context Persist**: Context tetap ada selama:
   - Session aktif (operator login)
   - Palet belum selesai diproses
   - Bisa diubah manual jika ada error

4. **Context Reset**: Operator bisa reset context untuk mulai proses baru dengan commodity yang berbeda

**Operator Workflow & Pallet Creation Timing**:

**Flow**: Scan → Create Pallet → Select Commodity → Weighing → Context Auto-fill

1. **First Scan**: Operator scan farmer/pallet ID
   - Jika pallet belum ada: **Buat pallet baru** (status: ACTIVE)
   - Jika pallet sudah ada: gunakan pallet yang ada
   - Setelah pallet ready, operator **memilih commodity** untuk sesi ini

2. **Commodity Selection**: Operator pilih commodity dari dropdown
   - Commodity **tidak** di-assign ke farmer (farmer bisa delivers multiple commodities)
   - Commodity disimpan di context + di pallet record
   - Context menjadi aktif untuk semua operasi berikutnya

3. **Weighing**: Operator input berat
   - Pallet sudah ada (dibuat di step 1)
   - Commodity auto-fill dari context
   - Grade bisa di-select atau auto-fill dari default

4. **Subsequent Operations**: Semua input menggunakan context
   - Sortir: grade + berat → commodity auto-fill
   - Packaging: pilih type → commodity auto-fill
   - Warehouse: scan → commodity auto-fill
   - Delivery: pilih packaging → commodity auto-fill

**Error Handling**:
- Jika pallet creation gagal: tampilkan error, operator bisa retry atau scan ID lain
- Jika commodity selection gagal: operator bisa pilih commodity lain atau reset context
- Context expiry: operator harus scan ulang + pilih commodity

**UI/UX Flow**:
```
┌─────────────────────────────────────────┐
│  Operator Dashboard                     │
├─────────────────────────────────────────┤
│  Current Context:                       │
│  👤 Farmer: Ahmad Santoso               │
│  🥔 Commodity: Kentang                  │
│  📦 Pallet: PLT-001                     │
│  [Reset Context]                        │
├─────────────────────────────────────────┤
│  Action:                                │
│  [Timbang] [Sortir] [Pack] [Warehouse]  │
│                                         │
│  When [Timbang]:                        │
│  - Grade: [▼ Pilih Grade]              │
│  - Berat: [____] kg                     │
│  - [Simpan]                             │
│  → Commodity otomatis: Kentang          │
└─────────────────────────────────────────┘
```

**Manfaat**:
- **Minimalkan input**: Operator hanya input 1-2 field (berat, grade)
- **Kurangi error**: Tidak ada input manual commodity yang bisa salah
- **Percepat proses**: Langsung scan → timbang → simpan
- **Konsisten**: Data selalu sesuai dengan context palet/farmer

**Implementasi Teknis**:
- Backend: Session store di Redis atau in-memory store
- Frontend: React Context + localStorage untuk offline capability
- MQTT: Topic include commodity untuk auto-routing
- API: Endpoint `/api/context` untuk get/set/reset context

---

### 1. `modules/auth` — Authentication & Authorization

**Fungsi**: Mengelola identitas pengguna dan hak akses berbasis role.

**Tanggung Jawab**:
- Registrasi user (Admin only)
- Login dengan JWT token generation
- Password hashing dengan bcrypt
- RBAC middleware untuk multiple roles: `ADMIN`, `WEIGHING_OPERATOR`, `SORTING_OPERATOR`, `WAREHOUSE_OPERATOR`, `DELIVERY_OPERATOR`, `FARMER`
- Token refresh & logout
- Proteksi endpoint berdasarkan role

**Alur Kerja**:
1. User login → verify password → generate JWT
2. Setiap request → middleware verifikasi JWT + role
3. Farmer bisa melihat data diri & setoran
4. Operator bisa operasional sesuai role (tim bangan, sortir, warehouse, delivery)
5. Admin full access + manage users

**Mapping ke Diagram**:
- Enterprise Level → Admin/Operator/Farmer access
- RBAC di semua endpoint

**API Endpoints**:
- `POST /api/auth/register` — Register user (admin only)
- `POST /api/auth/login` — Login, return JWT
- `GET /api/auth/me` — Get current user profile
- `POST /api/auth/refresh` — Refresh JWT token

---

### 2. `modules/farmers` — Farmer Management

**Fungsi**: Mengelola data petani dan identitas unik mereka.

**Tanggung Jawab**:
- CRUD farmer (nama, telepon, alamat, lokasi kebun)
- Generate unique farmer code (QR/barcode)
- Link farmer dengan user account
- Riwayat setoran per farmer per commodity
- Traceability data untuk export

**Alur Kerja**:
1. Admin/Operator input data petani baru
2. System generate unique code untuk petani
3. Saat panen, operator scan code petani → verify identitas
4. Operator **memilih commodity** yang ditimbang (bukan dari profil farmer)
5. Semua data penimbangan terkait dengan farmer ID + commodity ID (dari pilihan operator)

**Mapping ke Diagram**:
- Field Level → Smartphone Petani (scan ID)
- Sistem → Catat data penimbangan terkait farmer

**API Endpoints**:
- `GET /api/farmers` — List all farmers
- `POST /api/farmers` — Create farmer
- `GET /api/farmers/:id` — Get farmer detail
- `PUT /api/farmers/:id` — Update farmer
- `GET /api/farmers/:id/pallets` — Get farmer's pallets
- `GET /api/farmers/:id/summary` — Get farmer's grade summary

---

### 3. `modules/pallets` — Pallet Management

**Fungsi**: Mengelola palet pembawa hasil panen dan relasinya dengan farmer serta commodity.

**Tanggung Jawab**:
- Generate unique pallet code
- CRUD pallet
- Link pallet dengan farmer dan commodity
- Track weighing history per pallet per commodity
- Create pouch dari pallet (setelah grading)

**Alur Kerja**:
1. Petani datang → scan pallet/farmer → system create session context
   - Context: farmerId, commodityId, palletId, location
2. Pallet di-scan/di-generate code unik
3. Pallet ditimbang → data tersimpan ke database + commodity tag
   - Operator hanya input berat, commodity auto-fill dari context
4. Setelah grading, pallet dipecah menjadi pouch 1 kg

**Mapping ke Diagram**:
- Field Level → Penimbangan pada Palet Ber-ID
- Sistem → Keterkaitan Pallet ↔ Petani tersimpan

**API Endpoints**:
- `POST /api/pallets` — Create pallet (with farmer)
- `GET /api/pallets/:id` — Get pallet detail
- `GET /api/pallets/:id/weighings` — Get pallet weighing history
- `POST /api/pallets/:id/weigh` — Record initial weighing
- `POST /api/pallets/:id/pouches` — Create pouches from pallet

---

### 4. `modules/weighing` — Weighing & Grading

**Fungsi**: Pencatatan timbangan dan grading per commodity (misal: Grade A/B/C untuk kentang, Size L/M/S untuk tomat).

**Tanggung Jawab**:
- Record weighing per pallet (initial + per grade)
- Grade management per commodity
- Calculate total weight per grade per farmer per commodity
- MQTT integration untuk scale readings
- Real-time weighing events via Socket.io

**Alur Kerja**:
1. Pallet ditimbang di area penerimaan → record weighing + commodity
   - First scan: operator scan pallet/farmer → context created
   - Subsequent weighing: operator hanya input berat → commodity auto-fill dari context
2. Kentang/tomat/cabai di-sortir → grade sesuai commodity
3. Setiap grade ditimbang lagi → record per grade per commodity
   - Operator hanya pilih grade + input berat
   - Commodity otomatis dari context palet/farmer
4. System hitung total per grade per farmer per commodity
5. Real-time update ke dashboard

**MQTT Topics**:
```
enyx/<commodity>/penerimaan/scale/big       → weighing module
enyx/<commodity>/sortir/scale/grade-a       → weighing module
enyx/<commodity>/sortir/scale/grade-b       → weighing module
enyx/<commodity>/sortir/scale/grade-c       → weighing module
enyx/warehouse/scan/in                       → warehouse module
enyx/warehouse/scan/out                      → packaging/deliveries module
enyx/<commodity>/pengemasan/print            → labels module
enyx/delivery/truck/status                   → deliveries module
```

> **Catatan**: `<commodity>` adalah placeholder yang diganti dengan kode commodity, contoh: `enyx/kentang/penerimaan/scale/big`, `enyx/tomat/sortir/scale/grade-a`.

**MQTT Configuration**:
- **Broker**: Mosquitto 2.x (port 1883 untuk TCP, 9001 untuk WebSocket)
- **QoS**: 
  - Scale readings: QoS 1 (at least once) — data critical, tapi bisa tolerate duplicate
  - Commands (print, trigger): QoS 0 (at most once) — fire and forget
  - Status updates: QoS 1
- **Retain**: `false` untuk semua topic (data real-time, tidak perlu retain)
- **Payload Format**: JSON
  ```json
  {
    "deviceId": "scale-big-01",
    "weightKg": 45.5,
    "palletId": "PLT-001",
    "commodityId": "cmd-001",
    "timestamp": "2026-09-14T08:30:00Z"
  }
  ```
- **Subscription Strategy**: Backend subscribe ke semua topic dengan wildcard `enyx/#` lalu route berdasarkan topic pattern

**Mapping ke Diagram**:
- Field Level → Timbangan RS485
- Sistem → Catat Berat per Grade per Petani

**API Endpoints**:
- `POST /api/weighing` — Record weighing
- `GET /api/pallets/:id/weighings` — Get pallet weighing history
- `GET /api/farmers/:id/summary` — Get farmer's grade summary
- `GET /api/grades` — List all grades

---

### 5. `modules/warehouse` — Warehouse Stock Management

**Fungsi**: Manajemen stok warehouse masuk/keluar dan kapasitas per commodity.

**Tanggung Jawab**:
- CRUD warehouse
- WarehouseStock management (quantity per grade per commodity)
- Stock in: pouch created → add to warehouse stock
- Stock out: pouches packed into packaging → remove from stock
- Capacity tracking (sisa kapasitas warehouse)
- Real-time stock updates via Socket.io

**Alur Kerja**:
1. Pouches dibuat setelah grading → masuk ke warehouse per commodity
2. Operator scan pouch/pallet → system auto-fetch commodity + grade dari context
3. System update stock: quantity + total weight per grade per commodity
4. Check capacity per commodity: jika full → alert
5. Pouches dipack ke packaging unit → stock keluar
   - Operator scan packaging → commodity auto-fill
6. Real-time update ke dashboard warehouse

**Mapping ke Diagram**:
- Warehouse → Simpan Pouch di Warehouse
- Sistem → Catat Stok Masuk/Keluar, Update Kapasitas

**API Endpoints**:
- `GET /api/warehouse` — Get warehouse status
- `POST /api/warehouse/in` — Record stock in (pouch created)
- `POST /api/warehouse/out` — Record stock out (pouches to packaging)
- `GET /api/warehouse/summary` — Get stock summary by grade per commodity
- `GET /api/warehouse/capacity` — Get warehouse capacity per commodity

---

### 6. `modules/labels` — Label Generation

**Fungsi**: Generate QR Code, EAN-13, dan ITF-14 barcodes sesuai standar GS1, dengan dukungan multi-commodity.

**Tanggung Jawab**:
- QR Code generation (traceability: farmer, location, harvest date, grade, weight, commodity)
- EAN-13 generation (GTIN-13 + negara Indonesia `899` + commodity)
- ITF-14 generation (GTIN-14 + batch/lot + net/gross weight + commodity)
- Generate label images (PNG/PDF) untuk printing
- Integrasi dengan pouch creation dan packaging creation per commodity

**Alur Kerja**:
1. Pouches dibuat → generate QR + EAN-13 label (include commodity)
2. Packaging units dibuat → generate ITF-14 label (include commodity)
3. Label bisa di-print langsung atau di-download
4. Data label disimpan di database untuk traceability per commodity

**Mapping ke Diagram**:
- Pengemasan → Cetak & Tempel Label Pouch 1 kg (QR + EAN-13 + commodity)
- Pengemasan → Cetak & Tempel Barcode GS1 ITF-14 pada Packaging Unit

**API Endpoints**:
- `GET /api/labels/pouch/:pouchId` — Generate pouch label (QR + EAN-13)
- `GET /api/labels/packaging/:packagingId` — Generate packaging label (ITF-14)
- `POST /api/labels/print` — Print label via printer service
- `GET /api/labels/preview/:type/:id` — Preview label before print

---

### 7. `modules/packaging` — Packaging & Bundling

**Fungsi**: Pengelompokan item (pouch) menjadi unit pengemas yang lebih besar untuk distribusi, dengan dukungan multi-commodity.

**Tanggung Jawab**:
- CRUD packaging type per commodity (box, pallet, crate, dll.)
- CRUD packaging size/configuration per commodity
- Pack items into packaging units
- Generate packaging barcode (ITF-14, GS1-128, dll.)
- Validate packaging capacity
- Track which items are in which packaging
- Support multiple packaging hierarchies (pouch → box/unit → pallet)

**Alur Kerja**:
1. Admin/Operator define packaging types dan sizes per commodity
2. Operator pilih packaging type untuk dikemas
   - Commodity auto-dari context, tidak perlu input ulang
3. System generate packaging unit dengan barcode
4. Operator scan/select items untuk dimasukkan
   - Items otomatis ter-filter sesuai commodity di context
5. System validasi: jumlah item sesuai capacity?
6. Packaging siap untuk warehouse out / delivery

**Konsep General**:
- PackagingType: kategori pengemas (CARTON, BOX, PALLET, CRATE, dll.)
- PackagingSize: konfigurasi spesifik (10kg, 50kg, custom)
- PackagingUnit: instance konkret dari packaging dengan barcode unik
- PackagingItem: relasi antara item dan packaging unit

**Contoh Konfigurasi**:
```
PackagingType: CARTON
  → PackagingSize: 10kg (capacity: 10 pouch)
  → PackagingSize: 50kg (capacity: 50 pouch)

PackagingType: PALLET
  → PackagingSize: Standard (capacity: 20 units)
  → PackagingSize: Export (capacity: 40 units)
```

**Mapping ke Diagram**:
- Pengemasan → Packaging unit ekspor
- Pengemasan → Cetak & Tempel Barcode GS1 ITF-14
- Warehouse → Manajemen stok per packaging unit

**API Endpoints**:
- `GET /api/packaging/types` — List packaging types (filter by commodity)
- `POST /api/packaging/types` — Create packaging type per commodity (admin)
- `GET /api/packaging/sizes` — List packaging sizes (filter by type)
- `POST /api/packaging/sizes` — Create packaging size (admin)
- `POST /api/packaging/units` — Create packaging unit
- `POST /api/packaging/units/:id/pack` — Add items to packaging
- `GET /api/packaging/units/:id` — Get packaging detail + items
- `GET /api/packaging/units` — List all packaging units (filter by commodity)
- `DELETE /api/packaging/units/:id/items/:itemId` — Remove item from packaging

---

### 8. `modules/deliveries` — Delivery Management

**Fungsi**: Manajemen pengiriman dan tracking truck per commodity.

**Tanggung Jawab**:
- CRUD delivery
- Add packaging units to delivery
- Track truck departure
- Validate muatan (scan ITF-14, verify jumlah packaging, batch, tujuan, commodity)
- Delivery status tracking

**Alur Kerja**:
1. Packaging units siap untuk shipping → buat delivery
   - Commodity auto-dari context packaging/pallet
2. Assign packaging units ke delivery
3. Truck datang → muat packaging units
4. Scan ITF-14 untuk verifikasi muatan + commodity
5. Record truck departure (waktu, tujuan, nomor truck, commodity)
6. Update stock keluar warehouse per commodity

**Mapping ke Diagram**:
- Pengiriman → Muat Packaging Unit ke Delivery Truck
- Pengiriman → Scan Barcode ITF-14 Verifikasi Muatan + Commodity
- Sistem → Catat Keberangkatan Truck per Commodity

**API Endpoints**:
- `POST /api/deliveries` — Create delivery + commodity
- `POST /api/deliveries/:id/packaging` — Add packaging units to delivery
- `POST /api/deliveries/:id/depart` — Record truck departure
- `GET /api/deliveries/:id` — Get delivery detail + commodity info
- `GET /api/deliveries` — List all deliveries (filter by commodity)
- `GET /api/deliveries/:id/verify` — Verify shipment (ITF-14 scan + commodity)

---

## 🔧 Shared Components (`shared/`)

Shared components adalah infrastructure yang digunakan oleh semua modul. Mereka tidak mengandung business logic, hanya utility dan infrastructure.

---

### 1. `shared/mqtt` — MQTT Client

**Fungsi**: Menangani koneksi dan komunikasi dengan MQTT broker (Mosquitto).

**Tanggung Jawab**:
- MQTT client connection management
- Subscribe ke topics (scale readings, scanner events, printer commands)
- Publish commands (print label, trigger scan, status update)
- Message parsing & routing ke modul yang sesuai
- Connection health monitoring
- Auto-reconnect pada koneksi terputus

**MQTT Topics**:
```
enyx/penerimaan/scale/big       → weighing module
enyx/sortir/scale/grade-a       → weighing module
enyx/sortir/scale/grade-b       → weighing module
enyx/sortir/scale/grade-c       → weighing module
enyx/warehouse/scan/in          → warehouse module
enyx/warehouse/scan/out         → packaging/deliveries module
enyx/pengemasan/print           → labels module
enyx/delivery/truck/status      → deliveries module
```

**Alur Data**:
```
MQTT Broker (Mosquitto)
    ↓ subscribe
shared/mqtt
    ↓ parse & route by commodity
modules/weighing, warehouse, labels, deliveries
```

---

### 2. `shared/socket` — Socket.io Server

**Fungsi**: Real-time bidirectional communication dengan dashboard/web clients.

**Tanggung Jawab**:
- Socket.io server setup
- Room management (per-user, per-module)
- Event broadcasting untuk real-time updates
- Authentication via JWT handshake
- Connection/disconnection handling

**Socket Events**:
- `weighing:new` — New weighing recorded
- `warehouse:update` — Warehouse stock changed
- `scale:reading` — Live scale reading from MQTT
- `delivery:update` — Delivery status changed
- `label:printed` — Label successfully printed
- `packaging:created` — New packaging unit packed

**Alur Data**:
```
modules/* → emit event
shared/socket → broadcast to room
Dashboard clients ← receive real-time update
```

---

### 3. `shared/barcode` — Barcode Utilities

**Fungsi**: Utility functions untuk generate dan validate barcodes.

**Tanggung Jawab**:
- QR Code generation (traceability data)
- EAN-13 generation (GTIN-13 + negara 899)
- ITF-14 generation (GTIN-14 + batch + weight)
- Barcode validation & parsing
- Generate label layout (QR + EAN-13 side by side)
- Support untuk GS1 standards

**Library**: `bwip-js` (backend)

**Alur Data**:
```
modules/labels → request barcode
shared/barcode → generate image
modules/labels → return PNG/PDF
```

---

### 4. `shared/database` — Prisma Client

**Fungsi**: Database access layer yang di-share oleh semua modul.

**Tanggung Jawab**:
- Prisma client initialization
- Connection management
- Transaction helpers
- Soft delete helpers
- Pagination helpers
- Query logging & monitoring

**Alur Data**:
```
modules/* → query via Prisma
shared/database → PostgreSQL 17 + TimescaleDB
```

---

## 🔄 Alur Data Antar Modul

### Contoh: Weighing → Warehouse Flow

```
1. MQTT Message (scale reading)
   ↓
2. shared/mqtt → parse message
   ↓
3. modules/weighing → record weighing + calculate grade
   ↓
4. modules/warehouse → create pouch + update stock
   ↓
3. modules/labels → generate QR + EAN-13 (per commodity)
   ↓
6. shared/socket → broadcast `warehouse:update` to dashboard
```

### Contoh: Packaging → Delivery Flow

```
1. Operator creates packaging unit
   ↓
2. modules/packaging → validate + create packaging unit
   ↓
3. modules/labels → generate ITF-14 (per commodity)
   ↓
4. modules/warehouse → stock out per commodity (pouches removed)
   ↓
4. Operator creates delivery + adds packaging units
   ↓
6. modules/deliveries → verify shipment + depart
   ↓
7. shared/socket → broadcast `delivery:update`
```

---

## 📋 Modul vs Shared: Kapan Pakai Yang Mana?

| Komponen | Pakai Ketika | Contoh |
|-----------|--------------|--------|
| **Module** | Ada business logic spesifik domain | CRUD farmer, weighing record, warehouse stock |
| **Shared** | Infrastructure yang digunakan semua modul | MQTT, Socket.io, barcode generation, database |

**Rule of Thumb**:
- Jika ada **database table** dan **business rules** → Module
- Jika hanya **utility/infrastructure** tanpa business logic → Shared

---

## 🎯 Keuntungan Struktur Ini

1. **Separation of Concerns**: Setiap modul punya tanggung jawab jelas
2. **Easy to Test**: Modul bisa di-test secara isolated
3. **Easy to Extract**: Jika nanti butuh microservices, tinggal extract modul + shared yang dibutuhkan
4. **Team Friendly**: Beda orang bisa kerja di modul berbeda tanpa conflict
5. **Maintainable**: Codebase tidak menjadi "big ball of mud"

---

## 🔮 Migration Path ke Microservices

Jika nanti butuh microservices, modul bisa di-extract seperti ini:

```
Modular Monolith (MVP)
    ↓
Extract weighing-service (MQTT heavy, CPU intensive)
Extract label-service (barcode generation, printing)
Extract warehouse-service (inventory management)
Extract delivery-service (tracking, logistics)
    ↓
Microservices Architecture
```

**Trigger untuk extract**:
- Multi-facility deployment
- Tim engineering berkembang
- Performance bottleneck di specific module
- Business requirement untuk independent deployment

---

## 📚 Related Documentation

- `API.md` — Complete API endpoint registry with OpenAPI/Swagger documentation
- `TECH_STACK.md` — Technology choices and database schema
- `PLANNING.md` — Implementation phases and task breakdown
- `DIAGRAM.md` — Architecture diagrams and database ERD
