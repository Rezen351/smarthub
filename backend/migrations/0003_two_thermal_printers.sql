ALTER TABLE printer_settings DROP CONSTRAINT IF EXISTS printer_settings_id_check;
ALTER TABLE printer_settings ADD COLUMN IF NOT EXISTS station TEXT;

UPDATE printer_settings
SET station = CASE WHEN id = 1 THEN 'RECEPTION' ELSE 'PACKAGING' END
WHERE station IS NULL;

ALTER TABLE printer_settings ALTER COLUMN station SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS printer_settings_station_key ON printer_settings (station);

INSERT INTO printer_settings (id, station)
VALUES (2, 'PACKAGING')
ON CONFLICT (id) DO NOTHING;
