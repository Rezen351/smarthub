-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'FARMER');

-- CreateEnum
CREATE TYPE "WaringStatus" AS ENUM ('PENDING', 'APPROVED', 'SORTED');

-- CreateEnum
CREATE TYPE "PalletStatus" AS ENUM ('ACTIVE', 'IN_PACKAGING', 'DEPLETED');

-- CreateEnum
CREATE TYPE "PackageFormat" AS ENUM ('RETAIL_POUCH', 'EXPORT_CARTON');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('STORED', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "WashDecision" AS ENUM ('WASHED', 'UNWASHED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "village" TEXT,
    "address" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commodities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeSpec" TEXT,
    "description" TEXT,
    "commodityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "operatorId" TEXT,
    "grossWeightKg" DOUBLE PRECISION NOT NULL,
    "tareWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "netWeightKg" DOUBLE PRECISION NOT NULL,
    "status" "WaringStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "warings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorting_batches" (
    "id" TEXT NOT NULL,
    "waringId" TEXT NOT NULL,
    "operatorId" TEXT,
    "sizerFed" BOOLEAN NOT NULL DEFAULT true,
    "washDecision" "WashDecision" NOT NULL DEFAULT 'UNWASHED',
    "gradeA_Kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gradeB_Kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gradeC_Kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shrinkageKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shrinkagePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sorting_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "sortingBatchId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "remainingKg" DOUBLE PRECISION NOT NULL,
    "status" "PalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "format" "PackageFormat" NOT NULL DEFAULT 'RETAIL_POUCH',
    "grade" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "barcode" TEXT NOT NULL,
    "cartonSpec" TEXT,
    "sourcePalletId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "status" "PackageStatus" NOT NULL DEFAULT 'STORED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "truckPlate" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "operatorId" TEXT,
    "departedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "farmers_code_key" ON "farmers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "farmers_userId_key" ON "farmers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "commodities_code_key" ON "commodities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "commodities_name_key" ON "commodities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "grades_name_commodityId_key" ON "grades"("name", "commodityId");

-- CreateIndex
CREATE UNIQUE INDEX "warings_code_key" ON "warings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sorting_batches_waringId_key" ON "sorting_batches"("waringId");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_code_key" ON "pallets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "package_units_code_key" ON "package_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "package_units_barcode_key" ON "package_units"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_code_key" ON "deliveries"("code");

-- AddForeignKey
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warings" ADD CONSTRAINT "warings_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warings" ADD CONSTRAINT "warings_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warings" ADD CONSTRAINT "warings_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorting_batches" ADD CONSTRAINT "sorting_batches_waringId_fkey" FOREIGN KEY ("waringId") REFERENCES "warings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorting_batches" ADD CONSTRAINT "sorting_batches_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_sortingBatchId_fkey" FOREIGN KEY ("sortingBatchId") REFERENCES "sorting_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_units" ADD CONSTRAINT "package_units_sourcePalletId_fkey" FOREIGN KEY ("sourcePalletId") REFERENCES "pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_units" ADD CONSTRAINT "package_units_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
