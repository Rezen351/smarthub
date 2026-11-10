CREATE TABLE IF NOT EXISTS scale_settings (
    station TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    capacity_kg INTEGER NOT NULL CHECK (capacity_kg > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scale_settings (station, name, host, port, capacity_kg)
VALUES
    ('01', 'Station 01 Reception', 'scale-simulator', 5020, 150),
    ('02', 'Station 02 Sorting', 'scale-simulator', 5021, 100),
    ('03', 'Station 03 Packaging', 'scale-simulator', 5022, 30)
ON CONFLICT (station) DO NOTHING;
