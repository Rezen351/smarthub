-- Migration 0018: Audited pallet remainder closeouts and permanent sorting-batch provenance on package_units

ALTER TABLE "package_units"
    ADD COLUMN IF NOT EXISTS "sortingBatchId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'package_units_sortingBatchId_fkey'
    ) THEN
        ALTER TABLE "package_units"
            ADD CONSTRAINT "package_units_sortingBatchId_fkey"
            FOREIGN KEY ("sortingBatchId") REFERENCES "sorting_batches"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "pallet_closeouts" (
    "id" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "palletCode" TEXT NOT NULL,
    "sortingBatchId" TEXT,
    "farmerId" TEXT,
    "operatorId" TEXT,
    "grade" TEXT,
    "leftoverKg" DOUBLE PRECISION NOT NULL,
    "disposition" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "pallet_closeouts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pallet_closeouts_palletId_fkey"
        FOREIGN KEY ("palletId") REFERENCES "pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pallet_closeouts_createdAt_idx" ON "pallet_closeouts"("createdAt");
CREATE INDEX IF NOT EXISTS "pallet_closeouts_palletCode_idx" ON "pallet_closeouts"("palletCode");

