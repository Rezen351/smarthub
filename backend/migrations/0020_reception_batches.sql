CREATE SEQUENCE waring_code_seq;
SELECT setval('waring_code_seq', GREATEST(1, COALESCE((
    SELECT MAX(substring(code FROM '-([0-9]+)$')::bigint)
    FROM warings WHERE code ~ '^WRG-[0-9]{8}-[0-9]+$'
), 0)), true);

CREATE TABLE reception_batches (
    id TEXT PRIMARY KEY,
    "farmerId" TEXT NOT NULL REFERENCES farmers(id) ON DELETE RESTRICT,
    "operatorId" TEXT REFERENCES users(id) ON DELETE SET NULL,
    "requestHash" TEXT NOT NULL,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE warings ADD COLUMN "receptionBatchId" TEXT REFERENCES reception_batches(id) ON DELETE RESTRICT;
ALTER TABLE warings ADD COLUMN "captureId" TEXT;
CREATE UNIQUE INDEX warings_batch_capture_key ON warings("receptionBatchId", "captureId");
