import zipfile
import xml.etree.ElementTree as ET
import re

def generate():
    with zipfile.ZipFile('docs/Database Petani_Eptilu.xlsx') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                text = ''.join(t.text for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text)
                shared_strings.append(text)

        sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = sheet_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        
        cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
        farmers = []
        for idx, r in enumerate(rows[1:], start=2):
            row_num = r.attrib['r']
            cells = {c.attrib['r']: c for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c')}
            vals = []
            for col in cols:
                c = cells.get(f'{col}{row_num}')
                val = ''
                if c is not None:
                    t = c.attrib.get('t')
                    v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = v.text if v is not None else ''
                    if t == 's' and val:
                        val = shared_strings[int(val)]
                vals.append(val.strip() if isinstance(val, str) else '')
            
            name, gender, age, land_status, village, district, land_area, land_unit, join_year, prod, nik = vals
            
            clean_name = ' '.join(w.capitalize() for w in name.split())
            if 'istri pak suryana' in name.lower():
                clean_name = 'Nina'
                
            clean_village = ' '.join(w.capitalize() for w in village.split())
            if 'ci gedung' in village.lower():
                clean_village = 'Cigedug'
                
            clean_district = ' '.join(w.capitalize() for w in district.split())
            if 'ci gedug' in district.lower():
                clean_district = 'Cigedug'
                
            age_int = 'NULL'
            try:
                if age:
                    age_int = str(int(float(age)))
            except Exception:
                pass
                
            join_yr = 'NULL'
            if join_year and join_year != '-':
                try:
                    join_yr = "'" + str(int(float(join_year))) + "'"
                except Exception:
                    join_yr = f"'{join_year}'"
                    
            code = f'FMR-{idx:03d}'
            slug = re.sub(r'[^a-z0-9]+', '.', name.lower()).strip('.')
            email = f'{slug}@smartgeulisunpad.com'
            address = f'Desa {clean_village}, Kec. {clean_district}, Kab. Garut'
            nik_val = f"'{nik}'" if nik else 'NULL'
            land_status_val = f"'{land_status}'" if land_status else 'NULL'
            land_area_val = f"'{land_area}'" if land_area else 'NULL'
            land_unit_val = f"'{land_unit}'" if land_unit else 'NULL'
            prod_val = f"'{prod}'" if prod else 'NULL'
            
            farmers.append({
                'code': code,
                'name': clean_name.replace("'", "''"),
                'email': email,
                'gender': f"'{gender}'" if gender else 'NULL',
                'age': age_int,
                'land_status': land_status_val,
                'village': clean_village.replace("'", "''"),
                'district': clean_district.replace("'", "''"),
                'address': address.replace("'", "''"),
                'land_area': land_area_val,
                'land_unit': land_unit_val,
                'join_year': join_yr,
                'prod': prod_val,
                'nik': nik_val
            })

        sql = """-- Migration 0010: Seed farmer accounts and profiles from survey sheet

ALTER TABLE "farmers"
    ADD COLUMN IF NOT EXISTS "nik" TEXT,
    ADD COLUMN IF NOT EXISTS "gender" TEXT,
    ADD COLUMN IF NOT EXISTS "age" INTEGER,
    ADD COLUMN IF NOT EXISTS "landStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "district" TEXT,
    ADD COLUMN IF NOT EXISTS "landArea" TEXT,
    ADD COLUMN IF NOT EXISTS "landAreaUnit" TEXT,
    ADD COLUMN IF NOT EXISTS "joinYear" TEXT,
    ADD COLUMN IF NOT EXISTS "averageProduction" TEXT;

-- 1. Insert user records for farmers
INSERT INTO "users" ("id", "email", "name", "password", "role", "createdAt", "updatedAt")
VALUES
"""
        user_rows = []
        for f in farmers:
            user_rows.append(f"    (gen_random_uuid()::TEXT, '{f['email']}', '{f['name']}', '$2a$10$riKn1A7MMC/khxuLGjDffei/VfxRWh2oYxKJN6n4bow8HabUEVZO6', 'FARMER', NOW(), NOW())")
        sql += ',\n'.join(user_rows) + '\nON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = NOW();\n\n'

        sql += """-- 2. Insert farmer profiles linked to their user accounts
INSERT INTO "farmers" (
    "id",
    "code",
    "name",
    "phone",
    "village",
    "address",
    "userId",
    "nik",
    "gender",
    "age",
    "landStatus",
    "district",
    "landArea",
    "landAreaUnit",
    "joinYear",
    "averageProduction",
    "createdAt",
    "updatedAt"
)
VALUES
"""
        farmer_rows = []
        for f in farmers:
            user_subquery = f'(SELECT id FROM users WHERE email = \'{f["email"]}\')'
            row = f"    (gen_random_uuid()::TEXT, '{f['code']}', '{f['name']}', NULL, '{f['village']}', '{f['address']}', {user_subquery}, {f['nik']}, {f['gender']}, {f['age']}, {f['land_status']}, '{f['district']}', {f['land_area']}, {f['land_unit']}, {f['join_year']}, {f['prod']}, NOW(), NOW())"
            farmer_rows.append(row)
        sql += ',\n'.join(farmer_rows) + """
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "village" = EXCLUDED."village",
    "address" = EXCLUDED."address",
    "nik" = EXCLUDED."nik",
    "gender" = EXCLUDED."gender",
    "age" = EXCLUDED."age",
    "landStatus" = EXCLUDED."landStatus",
    "district" = EXCLUDED."district",
    "landArea" = EXCLUDED."landArea",
    "landAreaUnit" = EXCLUDED."landAreaUnit",
    "joinYear" = EXCLUDED."joinYear",
    "averageProduction" = EXCLUDED."averageProduction",
    "updatedAt" = NOW();
"""

        with open('backend/migrations/0010_seed_farmers_from_sheet.sql', 'w') as out:
            out.write(sql)
        print('Generated backend/migrations/0010_seed_farmers_from_sheet.sql successfully.')

if __name__ == '__main__':
    generate()

