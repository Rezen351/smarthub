-- Migration 0023: Make GTIN optional on raw general commodities
-- General commodities at reception do not have GS1; GS1 GTINs are defined and applied during packaging.

ALTER TABLE "commodities" ALTER COLUMN "gtin" DROP NOT NULL;
DROP INDEX IF EXISTS "commodities_gtin_key";
CREATE UNIQUE INDEX IF NOT EXISTS "commodities_gtin_key" ON "commodities"("gtin") WHERE "gtin" IS NOT NULL AND "gtin" <> '';
