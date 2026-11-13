-- Seed default potato commodity ('001' - Kentang Granola)
INSERT INTO "commodities" ("id", "code", "name", "description", "unit", "createdAt")
VALUES (
    'cmd-potato-001',
    '001',
    'Kentang Granola',
    'Granola potato suitable for table consumption and processing.',
    'kg',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- Seed potato commercial grades (A, B, C) linked to commodity '001'
INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT
    'grd-potato-a',
    'A',
    '>55mm',
    'Large table potato',
    c.id,
    NOW()
FROM "commodities" c
WHERE c.code = '001'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT
    'grd-potato-b',
    'B',
    '40-55mm',
    'Medium table potato',
    c.id,
    NOW()
FROM "commodities" c
WHERE c.code = '001'
ON CONFLICT ("name", "commodityId") DO NOTHING;

INSERT INTO "grades" ("id", "name", "sizeSpec", "description", "commodityId", "createdAt")
SELECT
    'grd-potato-c',
    'C',
    '<40mm',
    'Small baby potato',
    c.id,
    NOW()
FROM "commodities" c
WHERE c.code = '001'
ON CONFLICT ("name", "commodityId") DO NOTHING;

