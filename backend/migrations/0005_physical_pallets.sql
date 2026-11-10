ALTER TABLE "pallets" ALTER COLUMN "farmerId" DROP NOT NULL;
ALTER TABLE "pallets" ALTER COLUMN "sortingBatchId" DROP NOT NULL;
ALTER TABLE "pallets" ALTER COLUMN "grade" DROP NOT NULL;
ALTER TABLE "pallets" ALTER COLUMN "weightKg" SET DEFAULT 0;
ALTER TABLE "pallets" ALTER COLUMN "remainingKg" SET DEFAULT 0;
ALTER TABLE "pallets" ALTER COLUMN "status" TYPE TEXT USING status::text;
ALTER TABLE "pallets" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "tareKg" DOUBLE PRECISION NOT NULL DEFAULT 15.0;
ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO "pallets" ("id", "code", "status", "weightKg", "remainingKg", "tareKg", "notes")
VALUES
    ('plt-001', 'PLT-001', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-002', 'PLT-002', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-003', 'PLT-003', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-004', 'PLT-004', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-005', 'PLT-005', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-006', 'PLT-006', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-007', 'PLT-007', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-008', 'PLT-008', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-009', 'PLT-009', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet'),
    ('plt-010', 'PLT-010', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet')
ON CONFLICT ("code") DO NOTHING;
