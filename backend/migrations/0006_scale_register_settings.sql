ALTER TABLE scale_settings
    ADD COLUMN IF NOT EXISTS unit_id INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS weight_register INTEGER NOT NULL DEFAULT 40001,
    ADD COLUMN IF NOT EXISTS status_register INTEGER NOT NULL DEFAULT 40011;

ALTER TABLE scale_settings
    DROP CONSTRAINT IF EXISTS scale_settings_unit_id_check,
    DROP CONSTRAINT IF EXISTS scale_settings_weight_register_check,
    DROP CONSTRAINT IF EXISTS scale_settings_status_register_check;

ALTER TABLE scale_settings
    ADD CONSTRAINT scale_settings_unit_id_check CHECK (unit_id BETWEEN 1 AND 247),
    ADD CONSTRAINT scale_settings_weight_register_check CHECK (weight_register BETWEEN 40001 AND 40030),
    ADD CONSTRAINT scale_settings_status_register_check CHECK (status_register BETWEEN 40001 AND 40031);
