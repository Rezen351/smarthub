import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://enyx:enyx123@localhost:5432/enyx_smart_hub?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Purging all existing database records...');

  // Delete all existing transactional and master data in dependency order
  await prisma.packageUnit.deleteMany({});
  await prisma.pallet.deleteMany({});
  await prisma.sortingBatch.deleteMany({});
  await prisma.waring.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.commodity.deleteMany({});
  await prisma.farmer.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🌱 Seeding fresh master data (1 Admin, 1 Operator, 1 Farmer, 1 Commodity)...');

  // 1. Commodity: Kentang Granola
  const potato = await prisma.commodity.create({
    data: {
      code: '001',
      name: 'Kentang Granola',
      description: 'Granola potato suitable for table consumption and processing.',
      unit: 'kg',
    },
  });

  // 2. Potato Commercial Grades: A, B, C
  const grades = [
    { name: 'A', sizeSpec: '>55mm', description: 'Large table potato' },
    { name: 'B', sizeSpec: '40-55mm', description: 'Medium table potato' },
    { name: 'C', sizeSpec: '<40mm', description: 'Small baby potato' },
  ];

  for (const g of grades) {
    await prisma.grade.create({
      data: {
        name: g.name,
        sizeSpec: g.sizeSpec,
        description: g.description,
        commodityId: potato.id,
      },
    });
  }

  // 3. User 1: Admin
  const adminHashed = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@enyx.local',
      name: 'Administrator',
      password: adminHashed,
      role: 'ADMIN',
    },
  });

  // 4. User 2: Operator
  const operatorHashed = await bcrypt.hash('operator123', 10);
  const operatorUser = await prisma.user.create({
    data: {
      email: 'operator@enyx.local',
      name: 'Budi Hartono',
      password: operatorHashed,
      role: 'OPERATOR',
    },
  });

  // 5. User 3 & Profile: Farmer
  const farmerHashed = await bcrypt.hash('farmer123', 10);
  const farmerUser = await prisma.user.create({
    data: {
      email: 'farmer@enyx.local',
      name: 'Ahmad Santoso',
      password: farmerHashed,
      role: 'FARMER',
    },
  });

  const farmer = await prisma.farmer.create({
    data: {
      code: 'FMR-001',
      name: 'Ahmad Santoso',
      phone: '+62 812-3456-7890',
      village: 'Desa Sumber Brantas',
      address: 'Batu, Jawa Timur',
      userId: farmerUser.id,
    },
  });

  console.log('✅ Seed completed successfully:');
  console.log(`   - Commodity: ${potato.name} (${potato.code}) with Grades A, B, C`);
  console.log(`   - Admin: ${adminUser.email} (Administrator)`);
  console.log(`   - Operator: ${operatorUser.email} (Budi Hartono)`);
  console.log(`   - Farmer: ${farmerUser.email} / ${farmer.code} (Ahmad Santoso)`);
  console.log('   - Transactional records: 0 (clean production state)');
}

main()
  .catch((e) => {
    console.error('❌ Error executing seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
