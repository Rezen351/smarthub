ALTER TABLE users ADD COLUMN "cardCode" TEXT;
ALTER TABLE users ADD COLUMN nik TEXT;
ALTER TABLE users ADD COLUMN village TEXT;
ALTER TABLE users ADD COLUMN district TEXT;
ALTER TABLE users ADD COLUMN address TEXT;

CREATE UNIQUE INDEX users_card_code_key ON users ("cardCode") WHERE "cardCode" IS NOT NULL;
CREATE UNIQUE INDEX users_nik_key ON users (nik) WHERE nik IS NOT NULL;

UPDATE users SET "cardCode" = 'ADM-001' WHERE email = 'alif.muhammad.rizky@smartgeulisunpad.com';

INSERT INTO users (id, email, name, password, role, "cardCode", nik, village, district, address, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::TEXT, 'rizal.fahreza@smartgeulisunpad.com', 'Rizal Fahreza',
   '$2a$10$UAtz3CRCT.zCT6SfQiU7JuT3P/roZnZYpu6vfyAtcoEeyFnIaBIPi', 'ADMIN',
   'ADM-002', '3205180805910001', 'Cigedug', 'Cigedug', 'Desa Cigedug, Kec. Cigedug', NOW(), NOW()),
  (gen_random_uuid()::TEXT, 'fazrul.falah@smartgeulisunpad.com', 'Fazrul Falah',
   '$2a$10$dVn7MiqkmNz0MOjn8NVqueomamX02Lpqb72uNkjkq7QCwe8w9V5im', 'ADMIN',
   'ADM-003', '3205181001000002', 'Cigedug', 'Cigedug', 'Desa Cigedug, Kec. Cigedug', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'ADMIN',
  "cardCode" = EXCLUDED."cardCode",
  nik = EXCLUDED.nik,
  village = EXCLUDED.village,
  district = EXCLUDED.district,
  address = EXCLUDED.address,
  "updatedAt" = NOW();
