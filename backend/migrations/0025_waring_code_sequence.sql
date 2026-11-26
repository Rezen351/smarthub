CREATE SEQUENCE IF NOT EXISTS waring_code_seq START WITH 10000;

SELECT setval(
    'waring_code_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(substring(code FROM '-([0-9]+)$')::bigint)
            FROM warings
            WHERE code ~ '^WRG-[0-9]{8}-[0-9]+$'
        ), 9999),
        (SELECT last_value FROM waring_code_seq)
    ),
    true
);
