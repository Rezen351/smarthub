import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

// Helper to generate sequential Waring Code (e.g. WRG-20261026-0001)
const generateWaringCode = async (): Promise<string> => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `WRG-${yyyy}${mm}${dd}`;

  const countToday = await prisma.waring.count({
    where: {
      code: {
        startsWith: datePrefix,
      },
    },
  });

  const nextSeq = String(countToday + 1).padStart(4, '0');
  return `${datePrefix}-${nextSeq}`;
};

/**
 * GET /api/weighing
 * Retrieves intake warings, optional filter by status (?status=PENDING|APPROVED|SORTED)
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }

    const warings = await prisma.waring.findMany({
      where,
      include: {
        farmer: {
          select: { id: true, code: true, name: true, village: true },
        },
        commodity: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: warings.map((w) => ({
        id: w.id,
        code: w.code,
        farmerId: w.farmer.code,
        farmerCode: w.farmer.code,
        farmerName: w.farmer.name,
        farmerVillage: w.farmer.village,
        commodityName: w.commodity.name,
        grossWeightKg: w.grossWeightKg,
        tareWeightKg: w.tareWeightKg,
        netWeightKg: w.netWeightKg,
        status: w.status,
        note: w.note,
        createdAt: w.createdAt,
        approvedAt: w.approvedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to list warings' },
    });
  }
});

/**
 * POST /api/weighing
 * Records initial intake weighing from Station 01 floor scale
 */
router.post('/', async (req, res): Promise<void> => {
  try {
    const { farmerId, farmerCode, grossWeightKg, tareWeightKg = 1.2, note } = req.body;

    if (!grossWeightKg || isNaN(Number(grossWeightKg))) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid grossWeightKg is required' },
      });
      return;
    }

    // Resolve farmer by ID or Code strictly (disallow empty match)
    const farmerConditions: any[] = [];
    if (farmerId && typeof farmerId === 'string' && farmerId.trim()) {
      farmerConditions.push({ id: farmerId.trim() });
      farmerConditions.push({ code: { equals: farmerId.trim(), mode: 'insensitive' } });
    }
    if (farmerCode && typeof farmerCode === 'string' && farmerCode.trim()) {
      farmerConditions.push({ code: { equals: farmerCode.trim(), mode: 'insensitive' } });
    }

    if (farmerConditions.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid farmerId or farmerCode is required' },
      });
      return;
    }

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: farmerConditions,
      },
    });

    if (!farmer) {
      res.status(404).json({
        success: false,
        error: { code: 'FARMER_NOT_FOUND', message: 'Specified farmer could not be found' },
      });
      return;
    }

    // Default to Potato commodity
    const commodity = await prisma.commodity.findFirst({
      where: { code: '001' },
    });

    if (!commodity) {
      res.status(500).json({
        success: false,
        error: { code: 'COMMODITY_NOT_FOUND', message: 'Default potato commodity is not configured' },
      });
      return;
    }

    const code = await generateWaringCode();
    const gross = Number(grossWeightKg);
    const tare = Number(tareWeightKg);
    const net = Math.max(0, parseFloat((gross - tare).toFixed(2)));

    const waring = await prisma.waring.create({
      data: {
        code,
        farmerId: farmer.code,
        commodityId: commodity.id,
        grossWeightKg: gross,
        tareWeightKg: tare,
        netWeightKg: net,
        status: 'PENDING',
        note,
      },
      include: {
        farmer: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: waring.id,
        code: waring.code,
        farmerId: waring.farmer.code,
        farmerCode: waring.farmer.code,
        farmerName: waring.farmer.name,
        farmerVillage: waring.farmer.village,
        grossWeightKg: waring.grossWeightKg,
        tareWeightKg: waring.tareWeightKg,
        netWeightKg: waring.netWeightKg,
        status: waring.status,
        createdAt: waring.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to record intake weighing' },
    });
  }
});

/**
 * PATCH /api/weighing/:id/approve
 * Approves a pending waring, issuing approval timestamp and queuing to buffer
 */
router.patch('/:id/approve', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.waring.findUnique({
      where: { id },
      include: { farmer: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Waring '${id}' not found` },
      });
      return;
    }

    const updated = await prisma.waring.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
      include: { farmer: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to approve waring' },
    });
  }
});

/**
 * PATCH /api/weighing/:id/correct
 * Adjusts weight or note for pending waring
 */
router.patch('/:id/correct', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { grossWeightKg, note } = req.body;

    const existing = await prisma.waring.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Waring '${id}' not found` },
      });
      return;
    }

    const gross = grossWeightKg !== undefined ? Number(grossWeightKg) : existing.grossWeightKg;
    const net = Math.max(0, parseFloat((gross - existing.tareWeightKg).toFixed(2)));

    const updated = await prisma.waring.update({
      where: { id },
      data: {
        grossWeightKg: gross,
        netWeightKg: net,
        note: note !== undefined ? note : existing.note,
      },
      include: { farmer: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to update waring' },
    });
  }
});

export default router;
