-- Migration 0011: Migrate user email domain to @smartgeulisunpad.com

UPDATE "users"
SET "email" = REPLACE("email", '@enyx.local', '@smartgeulisunpad.com'),
    "updatedAt" = NOW()
WHERE "email" LIKE '%@enyx.local';

