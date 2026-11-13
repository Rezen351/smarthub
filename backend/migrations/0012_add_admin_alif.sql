-- Migration 0012: Add Alif Muhammad Rizky as Administrator

INSERT INTO "users" ("id", "email", "name", "password", "role", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::TEXT,
    'alif.muhammad.rizky@smartgeulisunpad.com',
    'Alif Muhammad Rizky',
    '$2a$10$Uz5VvhP.tWmXv/qHdJmlF.T4RmCtoM2E9SFbvZf/UrCR.VK0w9A6e',
    'ADMIN',
    NOW(),
    NOW()
)
ON CONFLICT ("email") DO UPDATE
SET "name" = EXCLUDED."name",
    "password" = EXCLUDED."password",
    "role" = 'ADMIN',
    "updatedAt" = NOW();

