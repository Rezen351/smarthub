-- Product numbers and GTINs are preserved verbatim from docs/ProductList.xlsx.
CREATE TABLE packaging_products (
    "productNumber" TEXT PRIMARY KEY,
    gtin TEXT NOT NULL,
    brand TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    package TEXT NOT NULL CHECK (package = 'box'),
    "nominalWeightKg" INTEGER NOT NULL CHECK ("nominalWeightKg" IN (1, 5, 10)),
    "washDecision" TEXT NOT NULL CHECK ("washDecision" IN ('WASHED', 'UNWASHED')),
    UNIQUE ("nominalWeightKg", "washDecision")
);
INSERT INTO packaging_products VALUES
('001','8994477090010','Eptilu Premium Potato','Washed potatoes 10 kg','box',10,'WASHED'),
('002','8994477090011','Eptilu Premium Potato','Unwashed potatoes 10 kg','box',10,'UNWASHED'),
('003','8994477090012','Eptilu Premium Potato','Washed potatoes 1 kg','box',1,'WASHED'),
('004','8994477090013','Eptilu Premium Potato','Unwashed potatoes 1 kg','box',1,'UNWASHED'),
('005','8994477090014','Eptilu Premium Potato','Washed potatoes 5 kg','box',5,'WASHED'),
('006','8994477090015','Eptilu Premium Potato','Unwashed potatoes 5 kg','box',5,'UNWASHED');

-- Historical packages intentionally have no inferred product identity.
ALTER TABLE package_units ADD COLUMN "productSnapshot" JSONB;
