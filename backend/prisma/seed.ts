import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default commodities
  const kentang = await prisma.commodity.upsert({
    where: { code: '001' },
    update: {},
    create: {
      name: 'Kentang',
      code: '001',
      description: 'Kentang',
      unit: 'kg',
    },
  });

  const tomat = await prisma.commodity.upsert({
    where: { code: '002' },
    update: {},
    create: {
      name: 'Tomat',
      code: '002',
      description: 'Tomat',
      unit: 'kg',
    },
  });

  const cabai = await prisma.commodity.upsert({
    where: { code: '003' },
    update: {},
    create: {
      name: 'Cabai',
      code: '003',
      description: 'Cabai',
      unit: 'kg',
    },
  });

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@enyx.local' },
    update: {},
    create: {
      email: 'admin@enyx.local',
      name: 'Admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Create default grades for each commodity
  const grades = ['A', 'B', 'C'];
  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { name_commodityId: { name: grade, commodityId: kentang.id } },
      update: {},
      create: {
        name: grade,
        commodityId: kentang.id,
        description: `Grade ${grade} untuk Kentang`,
      },
    });
  }

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { name_commodityId: { name: grade, commodityId: tomat.id } },
      update: {},
      create: {
        name: grade,
        commodityId: tomat.id,
        description: `Grade ${grade} untuk Tomat`,
      },
    });
  }

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { name_commodityId: { name: grade, commodityId: cabai.id } },
      update: {},
      create: {
        name: grade,
        commodityId: cabai.id,
        description: `Grade ${grade} untuk Cabai`,
      },
    });
  }

  const farmerPassword = await bcrypt.hash('password', 10);
  const farmerUser = await prisma.user.upsert({
    where: { email: 'farmer@enyx.local' },
    update: {},
    create: {
      email: 'farmer@enyx.local',
      name: 'Farmer',
      password: farmerPassword,
      role: 'FARMER',
    },
  });

  const farmer = await prisma.farmer.upsert({
    where: { userId: farmerUser.id },
    update: {},
    create: {
      name: 'Farmer',
      phone: '081234567890',
      address: 'Jl. Pertanian No. 1',
      location: 'Jakarta',
      userId: farmerUser.id,
    },
  });

  const commodities = [kentang, tomat, cabai];
  const allGrades = await prisma.grade.findMany();

  for (const commodity of commodities) {
    const pallet = await prisma.pallet.create({
      data: {
        code: `PAL-${commodity.code}-${Date.now().toString().slice(-4)}`,
        farmerId: farmer.id,
        commodityId: commodity.id,
        status: 'ACTIVE',
      },
    });

    const commodityGrades = allGrades.filter((g) => g.commodityId === commodity.id);
    const grade = commodityGrades[0];

    if (grade) {
      await prisma.weighingRecord.create({
        data: {
          farmerId: farmer.id,
          palletId: pallet.id,
          gradeId: grade.id,
          weightKg: Math.round(Math.random() * 500 + 100),
          userId: farmerUser.id,
          deviceId: 'SCALE-001',
        },
      });
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
