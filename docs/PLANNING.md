# 🗺️ Planning — Server-Side MVP (Fastest & Most Efficient)

Dokumen ini berisi rencana implementasi **server-side MVP** untuk ENYX-Smart Hub, difokuskan pada kecepatan pengembangan tanpa mengorbankan kualitas arsitektur.

---

## 🎯 MVP Definition

**Objective**: Bangun sistem backend yang bisa menangani alur inti pengemasan kentang:
1. Penerimaan hasil panen (tim bang + scan ID petani)
2. Pencucian opsional + sortir grade (A/B/C)
3. Pengemasan pouch 1 kg + generate label (QR + EAN-13)
4. Manajemen warehouse stok masuk/keluar
5. Pengemasan packaging ekspor (10kg/50kg) + generate ITF-14
6. Verifikasi muatan truck + catat keberangkatan

**Out of Scope untuk MVP**:
- Cloud backup sync ( bisa ditambahkan setelah MVP stabil )
- AI/ML features
- Mobile app native ( cukup PWA via browser )
- Advanced analytics/reporting ( basic reporting sudah cukup )

**Target Timeline**: 4-6 minggu untuk MVP production-ready

---

## 🏆 Tech Stack Pilihan (Fastest + Most Efficient)

Berdasarkan riset, berikut stack yang dipilih untuk kecepatan development:

| Komponen | Teknologi | Alasan |
|----------|-----------|--------|
| Runtime | **Node.js 20 LTS** | MQTT ecosystem terbaik, fast development |
| Language | **TypeScript** | Type safety, catching bugs early |
| Framework | **Express 5** | Minimalist, mature, banyak middleware |
| ORM | **Prisma 7** | Type-safe queries, auto-migration, excellent DX |
| Database | **PostgreSQL 17** | Reliable, ACID, banyak ecosystem |
| MQTT | **Mosquitto 2.x** | Ringan, stabil untuk LAN, mudah setup |
| MQTT Client | **mqtt.js** | Standard untuk Node.js |
| Real-time | **Socket.io 4** | WebSocket + fallback, rooms support |
| Auth | **JWT + bcryptjs** | Stateless, simple, cocok untuk RBAC |
| Validation | **Zod** | Runtime schema validation, TypeScript inference |
| Logging | **Winston** | Structured logging, multiple transports |
| Testing | **Jest + Supertest** | Standard untuk Node.js |
| Container | **Docker Compose** | Deployable dalam satu command |

---

## 🏗️ Project Structure

```
enyx-smart-hub/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts                 # Environment variables
│   │   │   ├── database.ts            # Prisma client
│   │   │   ├── mqtt.ts                # MQTT client config
│   │   │   └── swagger.ts             # OpenAPI/Swagger setup
│   │   ├── middlewares/
│   │   │   ├── auth.ts                # JWT verification
│   │   │   ├── rbac.ts                # Role-based access
│   │   │   ├── errorHandler.ts        # Global error handler
│   │   │   └── validate.ts            # Zod validation middleware
│   │   ├── modules/                   # Business logic modules (domain-driven)
│   │   │   ├── auth/                  # Authentication & RBAC
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.schema.ts
│   │   │   ├── farmers/               # Farmer management
│   │   │   │   ├── farmers.service.ts
│   │   │   │   ├── farmers.controller.ts
│   │   │   │   ├── farmers.routes.ts
│   │   │   │   └── farmers.schema.ts
│   │   │   ├── pallets/               # Pallet management
│   │   │   │   ├── pallets.service.ts
│   │   │   │   ├── pallets.controller.ts
│   │   │   │   ├── pallets.routes.ts
│   │   │   │   └── pallets.schema.ts
│   │   │   ├── weighing/              # Weighing & grading
│   │   │   │   ├── weighing.service.ts
│   │   │   │   ├── weighing.controller.ts
│   │   │   │   ├── weighing.routes.ts
│   │   │   │   └── weighing.schema.ts
│   │   │   ├── warehouse/             # Warehouse stock management
│   │   │   │   ├── warehouse.service.ts
│   │   │   │   ├── warehouse.controller.ts
│   │   │   │   ├── warehouse.routes.ts
│   │   │   │   └── warehouse.schema.ts
│   │   │   ├── labels/                # Barcode/QR generation
│   │   │   │   ├── labels.service.ts
│   │   │   │   ├── labels.controller.ts
│   │   │   │   ├── labels.routes.ts
│   │   │   │   └── labels.schema.ts
│   │   │   ├── packaging/             # Packaging & bundling
│   │   │   │   ├── packaging.service.ts
│   │   │   │   ├── packaging.controller.ts
│   │   │   │   ├── packaging.routes.ts
│   │   │   │   └── packaging.schema.ts
│   │   │   └── deliveries/            # Delivery management
│   │   │       ├── deliveries.service.ts
│   │   │       ├── deliveries.controller.ts
│   │   │       ├── deliveries.routes.ts
│   │   │       └── deliveries.schema.ts
│   │   ├── shared/                    # Shared infrastructure
│   │   │   ├── mqtt/                  # MQTT client
│   │   │   ├── socket/                # Socket.io
│   │   │   ├── barcode/               # Barcode utilities
│   │   │   └── database/              # Prisma client
│   │   ├── types/
│   │   │   ├── express.d.ts           # Express type extensions
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── jwt.ts                 # JWT helpers
│   │   │   ├── logger.ts              # Winston logger
│   │   │   └── errors.ts              # Custom error classes
│   │   └── index.ts                   # Express app + Socket.io + graceful shutdown
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                    # Seed data (admin, operator, farmer)
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── auth.test.ts
│   │   │   ├── weighing.test.ts
│   │   │   ├── warehouse.test.ts
│   │   │   └── labels.test.ts
│   │   └── integration/
│   │       ├── api.integration.test.ts
│   │       └── mqtt.integration.test.ts
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── docs/
│   ├── output_diagram.md
│   ├── TECH_STACK.md
│   ├── ARCHITECTURE.md
│   ├── PLANNING.md
│   ├── API.md
│   └── DIAGRAM.md
└── README.md
```

---

## 🚀 Implementation Phases

### Phase 0: Setup & Infrastructure (Week 1)

**Goal**: Setup project structure, database, MQTT broker, dan basic server

#### Tasks:
- [ ] Initialize Node.js + TypeScript project
- [ ] Setup Prisma + PostgreSQL schema
- [ ] Setup Docker Compose (PostgreSQL + Mosquitto + Backend)
- [ ] Implement basic Express server with health check
- [ ] Setup Winston logging
- [ ] Setup environment variables (.env.example)
- [ ] Create seed script (admin user, sample farmer, grades A/B/C)
- [ ] Setup Swagger/OpenAPI documentation
- [ ] Implement session context service (Redis/in-memory)
- [ ] Implement context API endpoints (get/set/reset)
- [ ] Implement context middleware untuk auto-fill commodity/farmer/pallet

**Deliverable**: Server running, database schema ready, MQTT broker connected, session context service ready

**Context API Endpoints**:
- `GET /api/context` - Get current operator session context
- `POST /api/context` - Set/update session context (from scan)
- `POST /api/context/reset` - Reset session context
- `GET /api/context/suggestions` - Get auto-complete suggestions based on context

---

### Phase 1: Authentication & Authorization (Week 1-2)

**Goal**: JWT-based auth dengan RBAC untuk multiple operator roles + admin + farmer

#### Tasks:
- [ ] Implement User model + registration
- [ ] Implement JWT token generation + verification
- [ ] Implement bcrypt password hashing
- [ ] Implement RBAC middleware (Admin/WeighingOperator/SortingOperator/WarehouseOperator/DeliveryOperator/Farmer)
- [ ] Implement login endpoint dengan JWT
- [ ] Implement protected route middleware
- [ ] Write unit tests untuk auth
- [ ] Setup Swagger docs untuk auth endpoints

**API Endpoints**:
- `POST /api/auth/register` - Register user (admin only)
- `POST /api/auth/login` - Login, return JWT
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/refresh` - Refresh JWT token

**Deliverable**: Auth system working, protected endpoints accessible

---

### Phase 2: Farmer & Pallet Management (Week 2)

**Goal**: CRUD untuk petani dan palet, scan ID petani, dengan session context auto-fill

#### Tasks:
- [ ] Implement Farmer CRUD endpoints (dengan commodity assignment)
- [ ] Implement Pallet CRUD endpoints
- [ ] Generate unique pallet code
- [ ] Link pallet dengan farmer dan commodity
- [ ] Implement farmer/pallet code scanning
- [ ] Implement context service integration (set context on scan)
- [ ] Write unit tests
- [ ] Update Swagger docs

**Context Flow**:
- Operator scan farmer/pallet → `POST /api/context` dengan scan result
- System return: farmerId, palletId, suggested commodities (jika ada riwayat)
- Operator pilih commodity yang ditimbang
- System save context: farmerId, commodityId (dari pilihan operator), palletId
- Subsequent requests auto-fill commodity/farmer dari context

**Catatan**: Commodity **tidak** di-assign ke farmer secara default. Operator yang memilih commodity saat penimbangan pertama karena petani bisa menyetorkan berbagai jenis hasil panen.

**API Endpoints**:
- `GET /api/farmers` - List all farmers (filter by commodity)
- `POST /api/farmers` - Create farmer
- `GET /api/farmers/:id` - Get farmer detail
- `PUT /api/farmers/:id` - Update farmer
- `GET /api/farmers/:id/pallets` - Get farmer's pallets
- `POST /api/pallets` - Create pallet (with farmer + commodity)
- `GET /api/pallets/:id` - Get pallet detail + commodity
- `POST /api/pallets/:id/weigh` - Record initial weighing
- `POST /api/context` - Set context from scan
- `GET /api/context` - Get current context

**Deliverable**: Farmer dan pallet management selesai dengan context auto-fill

---

### Phase 3: Weighing & Grade Management (Week 2-3)

**Goal**: Pencatatan timbangan dan grading per commodity dengan auto-fill context

#### Tasks:
- [ ] Implement WeighingRecord CRUD (dengan commodity selection)
- [ ] Implement Grade management per commodity
- [ ] Record weighing per pallet (initial + per grade)
- [ ] Calculate total weight per grade per farmer per commodity
- [ ] Implement MQTT integration untuk scale readings
- [ ] Implement real-time weighing via Socket.io
- [ ] Integrate dengan context service untuk auto-fill commodity setelah first weighing
- [ ] Write unit + integration tests
- [ ] Update Swagger docs

**Auto-Fill Flow**:
1. **First Weighing**: Operator scan pallet/farmer → pilih commodity → input berat
   - Commodity dipilih operator, bukan auto-fill
   - Context created: farmerId, commodityId (dari pilihan), palletId
2. **Subsequent Weighings**: Operator scan pallet/farmer → input berat saja
   - Commodity auto-fill dari context yang sudah dibuat saat first weighing
3. Backend validasi: grade belongs to commodity in context
4. Record weighing dengan commodityId dari context

**API Endpoints**:
- `POST /api/weighing` - Record weighing (first weighing requires commodity selection)
- `POST /api/weighing/quick` - Quick weighing dengan commodity auto-fill dari context
- `GET /api/pallets/:id/weighings` - Get pallet weighing history
- `GET /api/farmers/:id/summary` - Get farmer's grade summary per commodity
- `GET /api/grades` - List all grades (filter by commodity)
- `GET /api/context/suggestions/grades` - Get grade suggestions based on context commodity
- `POST /api/context` - Set context from scan + commodity selection

---

### Phase 4: Warehouse Management (Week 3-4)

**Goal**: Manajemen stok warehouse masuk/keluar dengan auto-fill commodity dari context

#### Tasks:
- [ ] Implement Warehouse CRUD
- [ ] Implement WarehouseStock management per commodity
- [ ] Implement pouch creation dengan QR + EAN-13
- [ ] Implement warehouse stock in (pouch created → add to stock)
- [ ] Implement warehouse stock out (pouches packed into packaging)
- [ ] Implement warehouse capacity tracking per commodity
- [ ] Integrate dengan context service untuk auto-fill commodity/grade
- [ ] Real-time stock updates via Socket.io
- [ ] Write unit + integration tests
- [ ] Update Swagger docs

**Auto-Fill Flow**:
- Operator scan pouch/pallet → system auto-fetch commodity + grade dari context/pallet
- Warehouse in: commodity, grade, quantity auto-fill
- Warehouse out: packaging scan → commodity auto-fill → stock keluar per commodity

**API Endpoints**:
- `GET /api/warehouse` - Get warehouse status per commodity
- `POST /api/warehouse/in` - Record stock in (commodity auto-fill)
- `POST /api/warehouse/out` - Record stock out (commodity auto-fill)
- `GET /api/warehouse/summary` - Get stock summary by grade per commodity
- `GET /api/warehouse/capacity` - Get warehouse capacity per commodity

**Deliverable**: Warehouse management system working dengan context auto-fill

---

### Phase 5: Label Generation (Week 4)

**Goal**: Generate QR Code, EAN-13, dan ITF-14 barcodes dengan auto-fill commodity dari context

#### Tasks:
- [ ] Implement QR Code generation (traceability data + commodity)
- [ ] Implement EAN-13 generation (GTIN-13 + negara 899 + commodity)
- [ ] Implement ITF-14 generation (GTIN-14 + batch + berat + commodity)
- [ ] Implement label printing endpoint (generate PNG/PDF)
- [ ] Integrate dengan pouch creation (commodity auto-fill)
- [ ] Integrate dengan packaging creation (commodity auto-fill)
- [ ] Write unit tests
- [ ] Update Swagger docs

**Library**: `bwip-js` (backend) untuk generate barcode images

**Auto-Fill Flow**:
- Label generation otomatis include commodity dari context/pouch/packaging
- Tidak perlu manual input commodity untuk label

**API Endpoints**:
- `GET /api/labels/pouch/:pouchId` - Generate pouch label (QR + EAN-13 + commodity)
- `GET /api/labels/packaging/:packagingId` - Generate packaging label (ITF-14 + commodity)
- `POST /api/labels/print` - Print label via printer service

**Deliverable**: Label generation working, printable labels dengan commodity auto-fill

---

### Phase 6: Packaging & Delivery Management (Week 4-5)

**Goal**: Packaging unit management dan manajemen pengiriman dengan auto-fill commodity

#### Tasks:
- [ ] Implement PackagingType + PackagingSize management per commodity
- [ ] Implement PackagingUnit creation
- [ ] Implement PackagingItem association (pack items into packaging)
- [ ] Implement PackagingDelivery association
- [ ] Implement truck departure tracking
- [ ] Implement delivery status tracking
- [ ] Integrate dengan context service untuk auto-fill commodity
- [ ] Write unit + integration tests
- [ ] Update Swagger docs

**Auto-Fill Flow**:
- Operator scan packaging/pallet → commodity auto-fill dari context
- Packaging creation: commodity auto-fill, tidak perlu input manual
- Delivery creation: commodity auto-fill dari packaging yang dipilih
- ITF-14 scan verification: commodity auto-validate

**API Endpoints**:
- `POST /api/packaging/types` - Create packaging type
- `POST /api/packaging/sizes` - Create packaging size
- `POST /api/packaging/units` - Create packaging unit (commodity auto-fill)
- `POST /api/packaging/units/:id/pack` - Add items to packaging
- `GET /api/packaging/units/:id` - Get packaging detail + items
- `POST /api/deliveries` - Create delivery (commodity auto-fill)
- `POST /api/deliveries/:id/packaging` - Add packaging units to delivery
- `POST /api/deliveries/:id/depart` - Record truck departure
- `GET /api/deliveries/:id` - Get delivery detail

**Deliverable**: Packaging dan delivery management selesai dengan context auto-fill

---

### Phase 7: Real-time & MQTT Integration (Week 5)

**Goal**: Real-time updates dan MQTT integration lengkap dengan context propagation

#### Tasks:
- [ ] Implement Socket.io server
- [ ] Implement real-time weighing events
- [ ] Implement real-time warehouse stock updates
- [ ] Implement MQTT → Socket.io bridge
- [ ] Implement MQTT command publish (print label, trigger scan)
- [ ] Implement context broadcast via Socket.io (update UI when context changes)
- [ ] Write integration tests
- [ ] Update Swagger docs

**Socket.io Events**:
- `weighing:new` - New weighing recorded
- `warehouse:update` - Warehouse stock changed
- `scale:reading` - Live scale reading from MQTT
- `delivery:update` - Delivery status changed
- `context:updated` - Operator session context updated (farmer/commodity/pallet changed)
- `context:reset` - Operator session context reset

**Context Flow via Socket.io**:
- Backend broadcast `context:updated` ke dashboard ketika operator scan baru
- Dashboard update UI secara real-time menampilkan context baru
- All subsequent forms auto-fill dari context yang baru

**Deliverable**: Real-time system working dengan context propagation

---

### Phase 8: Testing & Documentation (Week 5-6)

**Goal**: Testing lengkap dan dokumentasi

#### Tasks:
- [ ] Write unit tests untuk semua services
- [ ] Write integration tests untuk API endpoints
- [ ] Write MQTT integration tests
- [ ] Setup test coverage reporting
- [ ] Document API endpoints di Swagger
- [ ] Write README dengan setup instructions
- [ ] Write docker-compose setup guide
- [ ] Create Postman collection untuk testing
- [ ] Performance testing (load test dengan autocannon)
- [ ] Security audit (JWT, RBAC, input validation)

**Deliverable**: Test coverage > 80%, documentation complete

---

### Phase 9: Deployment & DevOps (Week 6)

**Goal**: Production-ready deployment

#### Tasks:
- [ ] Setup production Docker Compose
- [ ] Setup Nginx reverse proxy
- [ ] Setup SSL dengan Let's Encrypt
- [ ] Setup environment variables untuk production
- [ ] Setup logging ke file / stdout
- [ ] Setup health check endpoints
- [ ] Setup graceful shutdown
- [ ] Create deployment guide
- [ ] Setup cloud backup sync (optional, untuk setelah MVP)

**Deliverable**: Production-ready deployment

---

## 📊 MVP Feature Matrix

| Feature | Phase | Priority | Complexity |
|---------|-------|----------|------------|
| Authentication & RBAC | 1 | High | Medium |
| Farmer Management | 2 | High | Low |
| Pallet Management | 2 | High | Low |
| Weighing & Grading | 3 | High | Medium |
| MQTT Scale Integration | 3 | High | Medium |
| Warehouse Stock Management | 4 | High | Medium |
| QR/EAN-13 Label Generation | 5 | High | Medium |
| ITF-14 Label Generation | 5 | High | Medium |
| Packaging | 6 | High | Medium |
| Delivery Management | 6 | High | Low |
| Real-time Socket.io | 7 | Medium | Medium |
| Cloud Backup Sync | - | Low | Low |

---

## 🧪 Testing Strategy

### Unit Tests
- Auth service (JWT, bcrypt, RBAC)
- Barcode generation service
- Warehouse stock calculation
- Grade summary calculation

### Integration Tests
- Full API flow: register → login → create farmer → create pallet → weigh → create pouch → warehouse in → pack packaging → create delivery → depart
- MQTT message flow: publish → subscribe → database → socket.io
- Label generation flow

### Load Testing
- 100 concurrent weighing requests
- 1000 MQTT messages/second
- API response time < 200ms

---

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "express": "^5.0.0",
    "prisma": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "mqtt": "^5.0.0",
    "socket.io": "^4.7.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "zod": "^3.23.0",
    "winston": "^3.14.0",
    "cors": "^2.8.5",
    "helmet": "^8.0.0",
    "express-rate-limit": "^7.0.0",
    "bwip-js": "^4.0.0",
    "qrcode": "^1.5.3",
    "dotenv": "^16.4.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/cors": "^2.8.17",
    "typescript": "^5.6.0",
    "tsx": "^4.7.0",
    "nodemon": "^3.1.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^2.0.16",
    "ts-jest": "^29.2.0"
  }
}
```

---

## 🐳 Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: etani-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: etani
      POSTGRES_PASSWORD: etani123
      POSTGRES_DB: etani_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U etani"]
      interval: 5s
      timeout: 5s
      retries: 5

  mosquitto:
    image: eclipse-mosquitto:2
    container_name: etani-mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - mosquitto_data:/mosquitto/data
      - mosquitto_logs:/mosquitto/log
    command: mosquitto -c /mosquitto/config/mosquitto.conf

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: etani-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://etani:etani123@postgres:5432/etani_db?schema=public
      MQTT_BROKER_URL: mqtt://mosquitto:1883
      JWT_SECRET: your-super-secret-jwt-key-change-in-production
      PORT: 3000
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      mosquitto:
        condition: service_started
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  mosquitto_data:
  mosquitto_logs:
```

---

## ✅ MVP Success Criteria

Server-side MVP dianggap selesai ketika:

1. ✅ Semua endpoint inti berfungsi (weighing, warehouse, packaging, delivery)
2. ✅ MQTT integration working (scale readings masuk ke DB)
3. ✅ JWT + RBAC berjalan (3 role bisa akses sesuai permission)
4. ✅ Label generation working (QR, EAN-13, ITF-14)
5. ✅ Real-time updates via Socket.io
6. ✅ Test coverage > 80%
7. ✅ API documentation lengkap di Swagger
8. ✅ Docker Compose bisa deploy dalam satu command
9. ✅ Code quality: TypeScript strict, ESLint clean, Prettier formatted

---

## 🎯 Next Steps After MVP

1. **Frontend Development**: React dashboard dengan role-based views
2. **ESP32 Firmware**: MCU firmware untuk scale + scanner
3. **Cloud Backup**: Periodic sync ke Neon/Supabase
4. **Advanced Features**: 
   - Analytics & reporting
   - Batch/lot tracking lebih detail
   - Export Excel/PDF reports
   - SMS/Email notifications
   - Mobile PWA untuk petani

---

## 📝 Notes

- **Development speed**: Fokus ke MVP dulu, refactor setelah stabil
- **Database**: TimescaleDB bisa ditambahkan nanti jika data IoT meledak
- **Caching**: Redis bisa ditambahkan untuk hot data (bin locations, active deliveries)
- **Scaling**: Jika perlu scale, pisah MQTT worker dari API server
- **Security**: Tambah rate limiting, CORS restriction, input sanitization di setiap endpoint

---

## 📚 Related Documentation

- `API.md` — Complete API endpoint registry with OpenAPI/Swagger documentation
- `TECH_STACK.md` — Technology choices and database schema
- `ARCHITECTURE.md` — Module architecture and responsibilities
- `DIAGRAM.md` — Architecture diagrams and database ERD
