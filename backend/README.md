# Backend - ENYX-Smart Hub

Node.js + TypeScript + Express backend API for ENYX-Smart Hub.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run database migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Start development server
npm run dev
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/         # Environment, database, MQTT, swagger
│   ├── middlewares/    # Auth, RBAC, error handling, validation
│   ├── modules/        # Business logic modules
│   │   ├── auth/       # Authentication & RBAC
│   │   ├── farmers/    # Farmer management
│   │   ├── pallets/    # Pallet management
│   │   ├── weighing/   # Weighing & grading
│   │   ├── warehouse/  # Warehouse stock management
│   │   ├── labels/     # Barcode/QR generation
│   │   ├── packaging/  # Packaging & bundling
│   │   └── deliveries/ # Delivery management
│   ├── shared/         # MQTT, Socket.io, barcode, database
│   ├── types/          # TypeScript types
│   ├── utils/          # JWT, logger, errors
│   └── index.ts        # App entry point
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Database seed
├── tests/              # Unit & integration tests
├── .env.example        # Environment variables template
├── Dockerfile          # Production Docker image
└── package.json        # Dependencies & scripts
```

## 🔧 Scripts

```bash
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run start            # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:seed      # Seed database with initial data
npm test                 # Run tests
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

## 🔐 RBAC Roles

- `ADMIN` — Full access
- `WEIGHING_OPERATOR` — Weighing operations
- `SORTING_OPERATOR` — Grading & sorting
- `WAREHOUSE_OPERATOR` — Warehouse management
- `DELIVERY_OPERATOR` — Delivery & packaging
- `FARMER` — Traceability only

## 📡 MQTT Integration

The backend subscribes to MQTT topics for real-time scale readings:

```
enyx/<commodity>/penerimaan/scale/big
enyx/<commodity>/sortir/scale/grade-a
enyx/warehouse/scan/in
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```
