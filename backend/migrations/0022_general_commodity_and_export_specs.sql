-- Migration 0022: Separate general raw intake commodity name from export package specification
ALTER TABLE "commodities" ADD COLUMN IF NOT EXISTS "exportName" TEXT;

-- Update standard commodity records:
-- 001: General: Kentang | Export: Eptilu Washed Potatoes 10 kg | GTIN: 8994477090010
UPDATE "commodities"
SET "name" = 'Kentang',
    "exportName" = 'Eptilu Washed Potatoes 10 kg',
    "description" = 'Kentang panen segar'
WHERE "code" = '001';

-- 101: General: Tomat | Export: Eptilu Fresh Red Tomatoes TW 10 kg | GTIN: 8994477091017
UPDATE "commodities"
SET "name" = 'Tomat',
    "exportName" = 'Eptilu Fresh Red Tomatoes TW 10 kg',
    "description" = 'Tomat TW panen segar'
WHERE "code" = '101';

-- 201: General: Cabe Merah Keriting | Export: Eptilu Fresh Curly Red Chili Peppers 10 kg | GTIN: 8994477092014
UPDATE "commodities"
SET "name" = 'Cabe Merah Keriting',
    "exportName" = 'Eptilu Fresh Curly Red Chili Peppers 10 kg',
    "description" = 'Cabe merah keriting panen segar'
WHERE "code" = '201';

-- 202: General: Cabe Rawit Merah | Export: Eptilu Fresh Red Bird''s Eye Chili Peppers 10 kg | GTIN: 8994477092021
UPDATE "commodities"
SET "name" = 'Cabe Rawit Merah',
    "exportName" = 'Eptilu Fresh Red Bird''s Eye Chili Peppers 10 kg',
    "description" = 'Cabe rawit merah panen segar'
WHERE "code" = '202';
