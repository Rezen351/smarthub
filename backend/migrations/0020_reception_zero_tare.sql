-- Scale readings already account for the container weight.
ALTER TABLE warings ALTER COLUMN "tareWeightKg" SET DEFAULT 0;
