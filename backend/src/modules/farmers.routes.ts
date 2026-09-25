import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const farmers = await prisma.farmer.findMany({
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = farmers.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      phone: f.phone,
      address: f.address,
      location: f.location,
      user: f.user,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch farmers' },
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, address, location, userId } = req.body;

    if (!name || !userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name and userId are required' },
      });
    }

    const existing = await prisma.farmer.findUnique({
      where: { userId },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'FARMER_EXISTS', message: 'Farmer profile already exists for this user' },
      });
    }

    const farmer = await prisma.farmer.create({
      data: { name, phone, address, location, userId },
      include: { user: { select: { email: true, name: true } } },
    });

    res.status(201).json({ success: true, data: farmer });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create farmer' },
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true } },
        pallets: {
          include: { commodity: true },
        },
      },
    });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Farmer not found' },
      });
    }

    res.json({ success: true, data: farmer });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch farmer' },
    });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;

    const farmerIdentifier = userId || id;

    const farmer = await prisma.farmer.findFirst({
      where: userId ? { userId } : { id },
      select: { id: true, name: true },
    });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Farmer not found' },
      });
    }

    const totalResult = await prisma.weighingRecord.aggregate({
      where: { farmerId: farmer.id },
      _sum: { weightKg: true },
    });

    const weighings = await prisma.weighingRecord.findMany({
      where: { farmerId: farmer.id },
      include: {
        pallet: {
          include: {
            commodity: true,
          },
        },
      },
    });

    const commodityMap = new Map<string, { commodityId: string; commodityName: string; commodityCode: string; unit: string; totalKg: number }>();

    for (const w of weighings) {
      if (!w.pallet?.commodity) continue;
      const cid = w.pallet.commodity.id;
      const existing = commodityMap.get(cid);
      if (existing) {
        existing.totalKg += w.weightKg;
      } else {
        commodityMap.set(cid, {
          commodityId: cid,
          commodityName: w.pallet.commodity.name,
          commodityCode: w.pallet.commodity.code,
          unit: w.pallet.commodity.unit || 'kg',
          totalKg: w.weightKg,
        });
      }
    }

    const commodities = Array.from(commodityMap.values()).sort((a, b) => b.totalKg - a.totalKg);
    const totalDeposited = totalResult._sum.weightKg || 0;

    res.json({
      success: true,
      data: {
        farmerId: farmer.id,
        farmerName: farmer.name,
        totalDeposited,
        commodities,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch farmer summary' },
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, location } = req.body;

    const existing = await prisma.farmer.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Farmer not found' },
      });
    }

    const farmer = await prisma.farmer.update({
      where: { id },
      data: { name, phone, address, location },
      include: { user: { select: { email: true, name: true } } },
    });

    res.json({ success: true, data: farmer });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update farmer' },
    });
  }
});

export default router;
