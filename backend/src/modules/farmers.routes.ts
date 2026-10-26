import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

/**
 * GET /api/farmers
 * Returns all registered farmers
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const farmers = await prisma.farmer.findMany({
      include: {
        _count: {
          select: { warings: true, pallets: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    res.json({
      success: true,
      data: farmers.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        phone: f.phone,
        village: f.village,
        address: f.address,
        totalWarings: f._count.warings,
        totalPallets: f._count.pallets,
        createdAt: f.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to list farmers' },
    });
  }
});

/**
 * GET /api/farmers/:idOrCode/summary
 * Aggregate deposit summary for the farmer
 */
router.get('/:idOrCode/summary', async (req, res): Promise<void> => {
  try {
    const { idOrCode } = req.params;
    const query = idOrCode.trim();

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [
          { id: query },
          { code: { equals: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        warings: {
          include: {
            commodity: true,
          },
        },
      },
    });

    if (!farmer) {
      res.status(404).json({
        success: false,
        error: { code: 'FARMER_NOT_FOUND', message: `Farmer '${idOrCode}' not found` },
      });
      return;
    }

    const commodityMap = new Map<string, { commodityId: string; commodityName: string; commodityCode: string; unit: string; totalKg: number }>();
    let totalDeposited = 0;

    for (const w of farmer.warings) {
      const net = Number(w.netWeightKg || w.grossWeightKg);
      totalDeposited += net;
      const cId = w.commodityId || 'cmd-001';
      const cName = w.commodity?.name || 'Kentang Granola';
      const cCode = w.commodity?.code || '001';
      const existing = commodityMap.get(cId) || {
        commodityId: cId,
        commodityName: cName,
        commodityCode: cCode,
        unit: 'kg',
        totalKg: 0,
      };
      existing.totalKg += net;
      commodityMap.set(cId, existing);
    }

    if (commodityMap.size === 0) {
      const primaryCommodity = await prisma.commodity.findFirst();
      if (primaryCommodity) {
        commodityMap.set(primaryCommodity.id, {
          commodityId: primaryCommodity.id,
          commodityName: primaryCommodity.name,
          commodityCode: primaryCommodity.code,
          unit: 'kg',
          totalKg: 0,
        });
      }
    }

    res.json({
      success: true,
      data: {
        farmerId: farmer.id,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        totalDeposited: Number(totalDeposited.toFixed(1)),
        commodities: Array.from(commodityMap.values()).map((c) => ({
          ...c,
          totalKg: Number(c.totalKg.toFixed(1)),
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to fetch farmer summary' },
    });
  }
});

/**
 * GET /api/farmers/:idOrCode
 * Finds farmer by ID or Code (e.g. FMR-001)
 */
router.get('/:idOrCode', async (req, res): Promise<void> => {
  try {
    const { idOrCode } = req.params;
    const query = idOrCode.trim();

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [
          { id: query },
          { code: { equals: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        warings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!farmer) {
      res.status(404).json({
        success: false,
        error: { code: 'FARMER_NOT_FOUND', message: `Farmer '${idOrCode}' not found` },
      });
      return;
    }

    res.json({
      success: true,
      data: farmer,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to find farmer' },
    });
  }
});

export default router;
