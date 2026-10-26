import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

/**
 * GET /api/pallets
 * Retrieves pallets with optional filtering by grade (?grade=A|B|C) and status (?status=ACTIVE)
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const { grade, status } = req.query;

    const where: any = {};
    if (grade && typeof grade === 'string' && grade !== 'ALL') {
      where.grade = grade.toUpperCase();
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    const pallets = await prisma.pallet.findMany({
      where,
      include: {
        farmer: {
          select: { code: true, name: true, village: true },
        },
        sortingBatch: {
          include: {
            waring: {
              select: { code: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: pallets.map((p) => ({
        id: p.id,
        code: p.code,
        grade: p.grade,
        weightKg: p.weightKg,
        remainingKg: p.remainingKg,
        status: p.status,
        farmerName: p.farmer.name,
        farmerCode: p.farmer.code,
        farmerVillage: p.farmer.village,
        waringCode: p.sortingBatch.waring.code,
        createdAt: p.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to list pallets' },
    });
  }
});

/**
 * GET /api/pallets/:code
 * Resolves a pallet by its QR code string (e.g. PLT-GRD-A-01) for Station 03 scan verification
 */
router.get('/:code', async (req, res): Promise<void> => {
  try {
    const { code } = req.params;
    const query = code.trim().toUpperCase();

    const pallet = await prisma.pallet.findUnique({
      where: { code: query },
      include: {
        farmer: true,
        sortingBatch: {
          include: {
            waring: true,
          },
        },
      },
    });

    if (!pallet) {
      res.status(404).json({
        success: false,
        error: { code: 'PALLET_NOT_FOUND', message: `Pallet with code '${code}' not found` },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: pallet.id,
        code: pallet.code,
        grade: pallet.grade,
        weightKg: pallet.weightKg,
        remainingKg: pallet.remainingKg,
        status: pallet.status,
        farmerId: pallet.farmer.id,
        farmerName: pallet.farmer.name,
        farmerCode: pallet.farmer.code,
        farmerVillage: pallet.farmer.village,
        waringCode: pallet.sortingBatch.waring.code,
        waringIntakeWeight: pallet.sortingBatch.waring.grossWeightKg,
        washDecision: pallet.sortingBatch.washDecision,
        sortedAt: pallet.sortingBatch.sortedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to verify pallet' },
    });
  }
});

export default router;
