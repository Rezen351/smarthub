ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'LOADING';
ALTER TABLE package_units ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS package_units_delivery_status_idx ON package_units ("deliveryId", status);
CREATE SEQUENCE IF NOT EXISTS package_code_seq;
