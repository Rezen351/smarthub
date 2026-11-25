-- Add GTIN & catalog metadata to commodities, seed Eptilu catalog (001, 101, 201, 202),
-- and propagate commodityId to pallets, package_units, and pallet_closeouts.
ALTER TABLE "commodities" ADD COLUMN IF NOT EXISTS "gtin" TEXT;
ALTER TABLE "commodities" ADD COLUMN IF NOT EXISTS "brand" TEXT NOT NULL DEFAULT 'Eptilu';
ALTER TABLE "commodities" ADD COLUMN IF NOT EXISTS "packageType" TEXT NOT NULL DEFAULT 'Carton Box';
ALTER TABLE "commodities" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "commodities_gtin_key" ON "commodities"("gtin");

-- Ensure commodity 001 (Washed Potatoes) has its GS1 GTIN-13
INSERT INTO "commodities" ("id", "code", "name", "description", "unit", "gtin", "brand", "packageType", "isActive", "createdAt")
VALUES (
    'cmd-potato-001',
    '001',
    'Eptilu Washed Potatoes 10 kg',
    'Eptilu Washed Potatoes 10 kg (Carton Box)',
    'kg',
    '8994477090010',
    'Eptilu',
    'Carton Box',
    true,
    NOW()
)
ON CONFLICT ("code") DO UPDATE
SET "gtin" = EXCLUDED."gtin",
    "brand" = EXCLUDED."brand",
    "packageType" = EXCLUDED."packageType";

-- Seed commodity 101 (Fresh Red Tomatoes TW)
INSERT INTO "commodities" ("id", "code", "name", "description", "unit", "gtin", "brand", "packageType", "isActive", "createdAt")
VALUES (
    'cmd-tomato-101',
    '101',
    'Eptilu Fresh Red Tomatoes TW 10 kg',
    'Eptilu Fresh Red Tomatoes TW 10 kg (Carton Box)',
    'kg',
    '8994477091017',
    'Eptilu',
    'Carton Box',
    true,
    NOW()
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "unit" = EXCLUDED."unit",
    "gtin" = EXCLUDED."gtin",
    "brand" = EXCLUDED."brand",
    "packageType" = EXCLUDED."packageType";

-- Seed commodity 201 (Fresh Curly Red Chili Peppers)
INSERT INTO "commodities" ("id", "code", "name", "description", "unit", "gtin", "brand", "packageType", "isActive", "createdAt")
VALUES (
    'cmd-chili-201',
    '201',
    'Eptilu Fresh Curly Red Chili Peppers 10 kg',
    'Eptilu Fresh Curly Red Chili Peppers 10 kg (Carton Box)',
    'kg',
    '8994477092014',
    'Eptilu',
    'Carton Box',
    true,
    NOW()
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "unit" = EXCLUDED."unit",
    "gtin" = EXCLUDED."gtin",
    "brand" = EXCLUDED."brand",
    "packageType" = EXCLUDED."packageType";

-- Seed commodity 202 (Fresh Red Bird's Eye Chili Peppers)
INSERT INTO "commodities" ("id", "code", "name", "description", "unit", "gtin", "brand", "packageType", "isActive", "createdAt")
VALUES (
    'cmd-chili-202',
    '202',
    'Eptilu Fresh Red Bird''s Eye Chili Peppers 10 kg',
    'Eptilu Fresh Red Bird''s Eye Chili Peppers 10 kg (Carton Box)',
    'kg',
    '8994477092021',
    'Eptilu',
    'Carton Box',
    true,
    NOW()
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "unit" = EXCLUDED."unit",
    "gtin" = EXCLUDED."gtin",
    "brand" = EXCLUDED."brand",
    "packageType" = EXCLUDED."packageType";

-- Seed commercial grades (A, B, C) for Tomatoes ('101')
INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-tomato-a', 'A', 'Grade A', 'Premium round tomatoes', c.id, NOW()
FROM "commodities" c WHERE c.code = '101'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-tomato-b', 'B', 'Grade B', 'Medium round tomatoes', c.id, NOW()
FROM "commodities" c WHERE c.code = '101'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-tomato-c', 'C', 'Grade C', 'Processing tomatoes', c.id, NOW()
FROM "commodities" c WHERE c.code = '101'
ON CONFLICT ("name", "commodityId") DO NOTHING;

-- Seed commercial grades (A, B, C) for Curly Red Chili Peppers ('201')
INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-chili-a', 'A', 'Grade A', 'Premium curly red chili peppers', c.id, NOW()
FROM "commodities" c WHERE c.code = '201'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-chili-b', 'B', 'Grade B', 'Medium curly red chili peppers', c.id, NOW()
FROM "commodities" c WHERE c.code = '201'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-chili-c', 'C', 'Grade C', 'Processing curly red chili peppers', c.id, NOW()
FROM "commodities" c WHERE c.code = '201'
ON CONFLICT ("name", "commodityId") DO NOTHING;

-- Seed commercial grades (A, B, C) for Red Bird's Eye Chili Peppers ('202')
INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-chili-202-a', 'A', 'Grade A', 'Premium red bird''s eye chili peppers', c.id, NOW()
FROM "commodities" c WHERE c.code = '202'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-chili-202-b', 'B', 'Grade B', 'Medium red bird''s eye chili peppers', c.id, NOW()
FROM "commodities" c WHERE c.code = '202'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT 'grd-chili-202-c', 'C', 'Grade C', 'Processing red bird''s eye chili peppers', c.id, NOW()
FROM "commodities" c WHERE c.code = '202'
ON CONFLICT ("name", "commodityId") DO NOTHING;

-- Propagate commodityId to pallets, package_units, and pallet_closeouts
ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "commodityId" TEXT;
ALTER TABLE "package_units" ADD COLUMN IF NOT EXISTS "commodityId" TEXT;
ALTER TABLE "pallet_closeouts" ADD COLUMN IF NOT EXISTS "commodityId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pallets_commodityId_fkey') THEN
        ALTER TABLE "pallets"
            ADD CONSTRAINT "pallets_commodityId_fkey"
            FOREIGN KEY ("commodityId") REFERENCES "commodities"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_units_commodityId_fkey') THEN
        ALTER TABLE "package_units"
            ADD CONSTRAINT "package_units_commodityId_fkey"
            FOREIGN KEY ("commodityId") REFERENCES "commodities"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill pallets.commodityId from sorting_batches -> warings
UPDATE "pallets" p
SET "commodityId" = w."commodityId"
FROM "sorting_batches" sb
JOIN "warings" w ON w.id = sb."waringId"
WHERE p."sortingBatchId" = sb.id
  AND p."commodityId" IS NULL;

-- Backfill package_units.commodityId from sorting_batches -> warings, then fallback to default 001
UPDATE "package_units" pu
SET "commodityId" = w."commodityId"
FROM "sorting_batches" sb
JOIN "warings" w ON w.id = sb."waringId"
WHERE pu."sortingBatchId" = sb.id
  AND pu."commodityId" IS NULL;

UPDATE "package_units" pu
SET "commodityId" = c.id
FROM "commodities" c
WHERE c.code = '001'
  AND pu."commodityId" IS NULL;

-- Operational lookup indexes
CREATE INDEX IF NOT EXISTS "warings_commodityId_idx" ON "warings"("commodityId");
CREATE INDEX IF NOT EXISTS "pallets_commodityId_idx" ON "pallets"("commodityId");
CREATE INDEX IF NOT EXISTS "package_units_commodity_grade_status_idx" ON "package_units"("commodityId", "grade", "status");
