-- Migration 0010: Seed farmer accounts and profiles from survey sheet

ALTER TABLE "farmers"
    ADD COLUMN IF NOT EXISTS "nik" TEXT,
    ADD COLUMN IF NOT EXISTS "gender" TEXT,
    ADD COLUMN IF NOT EXISTS "age" INTEGER,
    ADD COLUMN IF NOT EXISTS "landStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "district" TEXT,
    ADD COLUMN IF NOT EXISTS "landArea" TEXT,
    ADD COLUMN IF NOT EXISTS "landAreaUnit" TEXT,
    ADD COLUMN IF NOT EXISTS "joinYear" TEXT,
    ADD COLUMN IF NOT EXISTS "averageProduction" TEXT;

-- 1. Insert user records for farmers
INSERT INTO "users" ("id", "email", "name", "password", "role", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::TEXT, 'aup.marup@smartgeulisunpad.com', 'Aup Marup', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'sutrisna@smartgeulisunpad.com', 'Sutrisna', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'akmal@smartgeulisunpad.com', 'Akmal', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'ihsan.abdul.rizki@smartgeulisunpad.com', 'Ihsan Abdul Rizki', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'ardi@smartgeulisunpad.com', 'Ardi', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'aqmal@smartgeulisunpad.com', 'Aqmal', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'fazry.dwi.taolani@smartgeulisunpad.com', 'Fazry Dwi Taolani', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'siti.rohmah@smartgeulisunpad.com', 'Siti Rohmah', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'dudi.wahyudin@smartgeulisunpad.com', 'Dudi Wahyudin', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'asep.ramdani@smartgeulisunpad.com', 'Asep Ramdani', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'hedi.hadiana@smartgeulisunpad.com', 'Hedi Hadiana', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'endang@smartgeulisunpad.com', 'Endang', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'herman.sugandi@smartgeulisunpad.com', 'Herman Sugandi', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'firman@smartgeulisunpad.com', 'Firman', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'muhamad.ridwan@smartgeulisunpad.com', 'Muhamad Ridwan', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'memod@smartgeulisunpad.com', 'Memod', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'rustandi@smartgeulisunpad.com', 'Rustandi', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'iwan@smartgeulisunpad.com', 'Iwan', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'rajib.hu@smartgeulisunpad.com', 'Rajib Hu', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'nina.istri.pak.suryana@smartgeulisunpad.com', 'Nina (Istri Pak Suryana)', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'yusuf@smartgeulisunpad.com', 'Yusuf', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = NOW();

-- 2. Insert farmer profiles linked to their user accounts
INSERT INTO "farmers" (
    "id",
    "code",
    "name",
    "phone",
    "village",
    "address",
    "userId",
    "nik",
    "gender",
    "age",
    "landStatus",
    "district",
    "landArea",
    "landAreaUnit",
    "joinYear",
    "averageProduction",
    "createdAt",
    "updatedAt"
)
VALUES
    (gen_random_uuid()::TEXT, 'FMR-002', 'Aup Marup', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'aup.marup@smartgeulisunpad.com'), '3205181211930001', 'Laki-laki', 53, 'Milik Sendiri', 'Cigedug', '0,5', 'hektar', '2025', '5.0', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-003', 'Sutrisna', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'sutrisna@smartgeulisunpad.com'), '3205180204880002', 'Laki-laki', 38, 'Sewa', 'Cigedug', '0,5', 'hektar', '2021', '7,5 - 8 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-004', 'Akmal', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'akmal@smartgeulisunpad.com'), NULL, 'Laki-laki', 21, 'Milik Sendiri', 'Cigedug', '2,5', 'Patok', '2026', '1 ton - 3 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-005', 'Ihsan Abdul Rizki', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'ihsan.abdul.rizki@smartgeulisunpad.com'), NULL, 'Laki-laki', 22, 'Milik Sendiri', 'Cigedug', '2.5', 'Patok', '2025', '2 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-006', 'Ardi', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'ardi@smartgeulisunpad.com'), NULL, 'Laki-laki', 17, 'Milik Sendiri', 'Cigedug', '2,5', 'patok', '2026', '2 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-007', 'Aqmal', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'aqmal@smartgeulisunpad.com'), NULL, 'Laki-laki', 18, 'Milik Sendiri', 'Cigedug', '2,5', 'patok', '2026', '2.0', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-008', 'Fazry Dwi Taolani', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'fazry.dwi.taolani@smartgeulisunpad.com'), NULL, 'Laki-laki', 17, 'Milik Sendiri', 'Cigedug', '2,5', 'patok', '2026', '2ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-009', 'Siti Rohmah', NULL, 'Sindangsari', 'Desa Sindangsari, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'siti.rohmah@smartgeulisunpad.com'), NULL, 'Perempuan', 88, 'Milik Sendiri', 'Cigedug', '5000.0', 'meter persegi', '2020', '3.5', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-010', 'Dudi Wahyudin', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'dudi.wahyudin@smartgeulisunpad.com'), NULL, 'Laki-laki', 40, 'Sewa', 'Cigedug', '5patok', 'tumbak', '2021', '1patok 1ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-011', 'Asep Ramdani', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'asep.ramdani@smartgeulisunpad.com'), '3205183010910001', 'Laki-laki', 35, 'Milik Sendiri', 'Cigedug', '125.0', 'tumbak', '2021', '4 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-012', 'Hedi Hadiana', NULL, 'Sukahurip', 'Desa Sukahurip, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'hedi.hadiana@smartgeulisunpad.com'), NULL, 'Laki-laki', 42, 'Milik Sendiri', 'Cigedug', '0.5', 'hektar', '2021', '12.5', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-013', 'Endang', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'endang@smartgeulisunpad.com'), '3205180107750130', 'Laki-laki', 50, 'Milik Sendiri', 'Cigedug', '5.0', '5 patok', '2021', '3 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-014', 'Herman Sugandi', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'herman.sugandi@smartgeulisunpad.com'), '3205180304900006', 'Laki-laki', 34, 'Sewa', 'Cigedug', '5 patok', 'tumbak', '2021', '3 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-015', 'Firman', NULL, 'Sukahurip', 'Desa Sukahurip, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'firman@smartgeulisunpad.com'), NULL, 'Laki-laki', 44, 'Milik Sendiri', 'Cigedug', '4.0', 'Patok', '2025', '3.0', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-016', 'Muhamad Ridwan', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'muhamad.ridwan@smartgeulisunpad.com'), '3205181203960001', 'Laki-laki', 30, 'Milik Sendiri', 'Cigedug', '0.5 hektar', 'hektar', '2021', '12 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-017', 'Memod', NULL, 'Sukahurip', 'Desa Sukahurip, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'memod@smartgeulisunpad.com'), '3205180107610030', 'Laki-laki', 65, 'Milik Sendiri', 'Cigedug', '25 batapatok dari 0.5 ha', 'bata', '2026', '3.0', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-018', 'Rustandi', NULL, 'Sukahurip', 'Desa Sukahurip, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'rustandi@smartgeulisunpad.com'), '3205182712910002', 'Laki-laki', 34, 'Sewa', 'Cigedug', '125.0', 'tumbak', '2026', '3 ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-019', 'Iwan', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'iwan@smartgeulisunpad.com'), '32051807011820002', 'Laki-laki', 34, 'Sewa', 'Cigedug', '12.0', 'tumbak', '2021', '3.0', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-020', 'Rajib Hu', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'rajib.hu@smartgeulisunpad.com'), '3205180107900242', 'Laki-laki', 3, NULL, 'Cigedug', '0,5', 'hektar', '2021', '10ton', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-021', 'Nina (Istri Pak Suryana)', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'nina.istri.pak.suryana@smartgeulisunpad.com'), NULL, 'Perempuan', 42, 'Sewa', 'Cigedug', '0,5', 'hektar', NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-022', 'Yusuf', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'yusuf@smartgeulisunpad.com'), '3205171304820006', 'Laki-laki', 42, 'Milik Sendiri', 'Cigedug', '10.0', 'Patok', '2021', '10.0', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "village" = EXCLUDED."village",
    "address" = EXCLUDED."address",
    "nik" = EXCLUDED."nik",
    "gender" = EXCLUDED."gender",
    "age" = EXCLUDED."age",
    "landStatus" = EXCLUDED."landStatus",
    "district" = EXCLUDED."district",
    "landArea" = EXCLUDED."landArea",
    "landAreaUnit" = EXCLUDED."landAreaUnit",
    "joinYear" = EXCLUDED."joinYear",
    "averageProduction" = EXCLUDED."averageProduction",
    "updatedAt" = NOW();
