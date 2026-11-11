WITH code_base AS (
    SELECT COALESCE(
        MAX(
            CASE
                WHEN code ~ '^FMR-[0-9]+$' THEN SUBSTRING(code FROM 5)::INTEGER
                ELSE 0
            END
        ),
        0
    ) AS maximum_code
    FROM farmers
), orphan_farmers AS (
    SELECT
        u.id AS user_id,
        u.name,
        ROW_NUMBER() OVER (ORDER BY u."createdAt", u.id) AS sequence_number
    FROM users u
    LEFT JOIN farmers f ON f."userId" = u.id
    WHERE u.role = 'FARMER' AND f.id IS NULL
)
INSERT INTO farmers (
    id,
    code,
    name,
    phone,
    village,
    address,
    "userId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    'FMR-' || LPAD((code_base.maximum_code + orphan_farmers.sequence_number)::TEXT, 3, '0'),
    orphan_farmers.name,
    NULL,
    NULL,
    NULL,
    orphan_farmers.user_id,
    NOW(),
    NOW()
FROM orphan_farmers
CROSS JOIN code_base
ON CONFLICT ("userId") DO NOTHING;
