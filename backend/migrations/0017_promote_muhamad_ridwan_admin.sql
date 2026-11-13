-- Migration 0017: Promote Muhamad Ridwan from FARMER (FMR-016) to ADMIN (ADM-004) without changing any other IDs

UPDATE users u
SET role = 'ADMIN',
    "cardCode" = 'ADM-004',
    nik = COALESCE(u.nik, (SELECT f.nik FROM farmers f WHERE f."userId" = u.id LIMIT 1), '3205181203960001'),
    village = COALESCE(u.village, (SELECT f.village FROM farmers f WHERE f."userId" = u.id LIMIT 1), 'Cigedug'),
    district = COALESCE(u.district, (SELECT f.district FROM farmers f WHERE f."userId" = u.id LIMIT 1), 'Cigedug'),
    address = 'Desa Cigedug, Kec. Cigedug',
    "updatedAt" = NOW()
WHERE u.email = 'muhamad.ridwan@smartgeulisunpad.com';

DELETE FROM farmers f
USING users u
WHERE f."userId" = u.id
  AND u.email = 'muhamad.ridwan@smartgeulisunpad.com'
  AND NOT EXISTS (SELECT 1 FROM warings w WHERE w."farmerId" = f.id)
  AND NOT EXISTS (SELECT 1 FROM pallets p WHERE p."farmerId" = f.id);

