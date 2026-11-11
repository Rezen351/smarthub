-- Migration 0009: Add permanent pallet code columns to sorting_batches and seed full physical pallet inventory

ALTER TABLE sorting_batches
    ADD COLUMN IF NOT EXISTS "gradeA_PalletCode" text,
    ADD COLUMN IF NOT EXISTS "gradeB_PalletCode" text,
    ADD COLUMN IF NOT EXISTS "gradeC_PalletCode" text;

-- Ensure physical pallets PLT-001 through PLT-010 exist
INSERT INTO pallets (id, code, status, "weightKg", "remainingKg", "tareKg", notes, "createdAt", "updatedAt")
VALUES
    ('plt-001', 'PLT-001', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-002', 'PLT-002', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-003', 'PLT-003', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-004', 'PLT-004', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-005', 'PLT-005', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-006', 'PLT-006', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-007', 'PLT-007', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-008', 'PLT-008', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-009', 'PLT-009', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW()),
    ('plt-010', 'PLT-010', 'AVAILABLE', 0, 0, 15.0, 'Standard wood pallet', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Backfill permanent pallet codes from currently linked pallets
UPDATE sorting_batches sb
SET "gradeA_PalletCode" = p.code
FROM pallets p
WHERE p."sortingBatchId" = sb.id AND p.grade = 'A' AND sb."gradeA_PalletCode" IS NULL;

UPDATE sorting_batches sb
SET "gradeB_PalletCode" = p.code
FROM pallets p
WHERE p."sortingBatchId" = sb.id AND p.grade = 'B' AND sb."gradeB_PalletCode" IS NULL;

UPDATE sorting_batches sb
SET "gradeC_PalletCode" = p.code
FROM pallets p
WHERE p."sortingBatchId" = sb.id AND p.grade = 'C' AND sb."gradeC_PalletCode" IS NULL;

-- Backfill any historical sorting batches where pallets was overwritten
UPDATE sorting_batches
SET "gradeA_PalletCode" = COALESCE("gradeA_PalletCode", 'PLT-001'),
    "gradeB_PalletCode" = COALESCE("gradeB_PalletCode", 'PLT-002'),
    "gradeC_PalletCode" = COALESCE("gradeC_PalletCode", 'PLT-003')
WHERE "gradeA_PalletCode" IS NULL OR "gradeB_PalletCode" IS NULL OR "gradeC_PalletCode" IS NULL;

