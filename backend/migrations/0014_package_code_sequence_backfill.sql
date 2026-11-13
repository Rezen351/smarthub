SELECT setval(
    'package_code_seq',
    GREATEST(
        COALESCE((
            SELECT MAX(substring(code FROM '-([0-9]+)$')::bigint)
            FROM package_units
            WHERE code ~ '^(PCH|EXP)-[0-9]{8}-[0-9]+$'
        ), 0),
        (SELECT last_value FROM package_code_seq)
    ),
    true
);
