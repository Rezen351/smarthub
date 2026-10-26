import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

// Helper to generate sequential Package Code (PCH-20261026-0001 or EXP-20261026-0001)
const generatePackageCode = async (format: 'RETAIL_POUCH' | 'EXPORT_CARTON'): Promise<string> => {
  const prefix = format === 'RETAIL_POUCH' ? 'PCH' : 'EXP';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${prefix}-${yyyy}${mm}${dd}`;

  const countToday = await prisma.packageUnit.count({
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
 * POST /api/packaging/pack
 * Records a weighed unit (1 kg retail pouch or 10/50 kg export carton), inheriting grade from pallet
 */
router.post('/pack', async (req, res): Promise<void> => {
  try {
    const targetPalletCode = (req.body.sourcePalletCode || req.body.palletCode || '').trim().toUpperCase();
    const targetPalletId = req.body.sourcePalletId || req.body.palletId;
    const rawWeight = req.body.weightKg || req.body.totalNetWeightKg;
    const format = req.body.format || (req.body.packageTypeCode?.includes('CARTON') ? 'EXPORT_CARTON' : 'RETAIL_POUCH');
    const cartonSpec = req.body.cartonSpec;

    if (!rawWeight || isNaN(Number(rawWeight))) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid weightKg is required' },
      });
      return;
    }

    const pallet = await prisma.pallet.findFirst({
      where: {
        OR: [
          targetPalletCode ? { code: targetPalletCode } : {},
          targetPalletId ? { id: targetPalletId } : {},
        ],
      },
      include: {
        farmer: true,
        sortingBatch: {
          include: { waring: true },
        },
      },
    });

    if (!pallet) {
      res.status(404).json({
        success: false,
        error: { code: 'PALLET_NOT_FOUND', message: 'Source pallet could not be found' },
      });
      return;
    }

    const unitWeight = parseFloat(Number(rawWeight).toFixed(3));
    if (pallet.remainingKg < unitWeight) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PALLET_WEIGHT',
          message: `Pallet ${pallet.code} only has ${pallet.remainingKg} kg remaining`,
        },
      });
      return;
    }

    const packageFormat = format === 'EXPORT_CARTON' ? 'EXPORT_CARTON' : 'RETAIL_POUCH';
    const code = await generatePackageCode(packageFormat);

    // Generate compliant barcode string
    const barcode = packageFormat === 'RETAIL_POUCH'
      ? `https://id.enyx.io/01/8991234567890/21/${code}`
      : `1899123456${code.replace(/[^0-9]/g, '').slice(-4)}`;

    const newRemaining = Math.max(0, parseFloat((pallet.remainingKg - unitWeight).toFixed(3)));
    const newStatus = newRemaining < 0.5 ? 'DEPLETED' : 'ACTIVE';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create PackageUnit with grade strictly locked to source pallet
      const unit = await tx.packageUnit.create({
        data: {
          code,
          format: packageFormat,
          grade: pallet.grade,
          weightKg: unitWeight,
          barcode,
          cartonSpec: packageFormat === 'EXPORT_CARTON' ? cartonSpec || '10kg' : null,
          sourcePalletId: pallet.id,
          status: 'STORED',
        },
      });

      // 2. Deduct remaining weight on pallet
      await tx.pallet.update({
        where: { id: pallet.id },
        data: {
          remainingKg: newRemaining,
          status: newStatus,
        },
      });

      return unit;
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        code: result.code,
        format: result.format,
        grade: result.grade,
        weightKg: result.weightKg,
        barcode: result.barcode,
        cartonSpec: result.cartonSpec,
        sourcePalletCode: pallet.code,
        farmerName: pallet.farmer.name,
        waringCode: pallet.sortingBatch.waring.code,
        status: result.status,
        createdAt: result.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to record package unit' },
    });
  }
});

/**
 * GET /api/packaging/records
 * Returns packaging records (today's units and totals)
 */
router.get('/records', async (req, res): Promise<void> => {
  try {
    const packages = await prisma.packageUnit.findMany({
      include: {
        sourcePallet: {
          include: {
            farmer: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: packages.map((p) => ({
        id: p.id,
        code: p.code,
        format: p.format === 'RETAIL_POUCH' ? '1 kg Retail Pouch' : `${p.cartonSpec || '10 kg'} Export Carton`,
        grade: p.grade,
        weightKg: p.weightKg,
        barcode: p.barcode,
        sourcePalletCode: p.sourcePallet.code,
        farmerName: p.sourcePallet.farmer.name,
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to list packaging records' },
    });
  }
});

export default router;
