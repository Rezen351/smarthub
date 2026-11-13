-- Migration 0015: Seed additional farmer accounts and profiles from 'to Alif_Database Petani_Eptilu_Tambahan.xlsx'
-- Note: Row 'Sutrisna' (NIK 3205180204880002) is excluded because it duplicates existing farmer FMR-003.

-- 1. Insert user records for the 13 new farmers
INSERT INTO "users" ("id", "email", "name", "password", "role", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::TEXT, 'cepi.hendriana@smartgeulisunpad.com', 'Cepi Hendriana', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'cecep.sunandar@smartgeulisunpad.com', 'Cecep Sunandar', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'jezi.ahmad.hubaeni.fauzi@smartgeulisunpad.com', 'Jezi Ahmad Hubaeni Fauzi', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'dedi.hermawan@smartgeulisunpad.com', 'Dedi Hermawan', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'ridwan.ahmad.fauzi@smartgeulisunpad.com', 'Ridwan Ahmad Fauzi', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'iwan.s.al.afghany@smartgeulisunpad.com', 'Iwan S Al Afghany', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'dasep.badrusalam@smartgeulisunpad.com', 'Dasep Badrusalam', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'ade.cucu@smartgeulisunpad.com', 'Ade Cucu', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'sarip@smartgeulisunpad.com', 'Sarip', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'nepi.purnama.alam@smartgeulisunpad.com', 'Nepi Purnama Alam', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'agus.ridwan@smartgeulisunpad.com', 'Agus Ridwan', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'bagus.saptaji@smartgeulisunpad.com', 'Bagus Saptaji', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'rahman@smartgeulisunpad.com', 'Rahman', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = NOW();

-- 2. Insert farmer profiles linked to their user accounts (FMR-023 through FMR-035)
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
    (gen_random_uuid()::TEXT, 'FMR-023', 'Cepi Hendriana', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'cepi.hendriana@smartgeulisunpad.com'), '3205180802050001', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-024', 'Cecep Sunandar', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'cecep.sunandar@smartgeulisunpad.com'), '3205180507900001', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-025', 'Jezi Ahmad Hubaeni Fauzi', NULL, 'Sukahurip', 'Desa Sukahurip, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'jezi.ahmad.hubaeni.fauzi@smartgeulisunpad.com'), '3205181501910001', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-026', 'Dedi Hermawan', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'dedi.hermawan@smartgeulisunpad.com'), '3205180107740078', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-027', 'Ridwan Ahmad Fauzi', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'ridwan.ahmad.fauzi@smartgeulisunpad.com'), '3205181503000002', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-028', 'Iwan S Al Afghany', NULL, 'Sukahurip', 'Desa Sukahurip, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'iwan.s.al.afghany@smartgeulisunpad.com'), '3205180711820002', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-029', 'Dasep Badrusalam', NULL, 'Sindangmekar', 'Desa Sindangmekar, Kec. Wanaraja, Kab. Garut', (SELECT id FROM users WHERE email = 'dasep.badrusalam@smartgeulisunpad.com'), '3205182509860000', 'Laki-laki', NULL, NULL, 'Wanaraja', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-030', 'Ade Cucu', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'ade.cucu@smartgeulisunpad.com'), '3205182107730002', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-031', 'Sarip', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'sarip@smartgeulisunpad.com'), '3205180107820185', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-032', 'Nepi Purnama Alam', NULL, 'Cigedug', 'Desa Cigedug, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'nepi.purnama.alam@smartgeulisunpad.com'), '3205182111960002', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-033', 'Agus Ridwan', NULL, 'Barusuda', 'Desa Barusuda, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'agus.ridwan@smartgeulisunpad.com'), '3205181108840002', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-034', 'Bagus Saptaji', NULL, 'Sindangsari', 'Desa Sindangsari, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'bagus.saptaji@smartgeulisunpad.com'), '3205180310920001', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'FMR-035', 'Rahman', NULL, 'Sindangsari', 'Desa Sindangsari, Kec. Cigedug, Kab. Garut', (SELECT id FROM users WHERE email = 'rahman@smartgeulisunpad.com'), '3205180606840002', 'Laki-laki', NULL, NULL, 'Cigedug', NULL, NULL, NULL, NULL, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "village" = EXCLUDED."village",
    "address" = EXCLUDED."address",
    "nik" = EXCLUDED."nik",
    "gender" = EXCLUDED."gender",
    "district" = EXCLUDED."district",
    "updatedAt" = NOW();
