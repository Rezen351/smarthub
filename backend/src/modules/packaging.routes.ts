import { Router } from 'express';
import prisma from '../shared/database/prisma';
import {
  calculatePackagingAllocation,
  PackagingValidationError,
} from './packaging.validation';

const router = Router();

const getPackageCodePrefix = (format: 'RETAIL_POUCH' | 'EXPORT_CARTON'): string => {
  const prefix = format === 'RETAIL_POUCH' ? 'PCH' : 'EXP';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${yyyy}${mm}${dd}`;
};

const createPackageCode = (prefix: string, sequence: number): string => {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

const createPackageBarcode = (
  format: 'RETAIL_POUCH' | 'EXPORT_CARTON',
  code: string,
): string => {
  return format === 'RETAIL_POUCH'
    ? `https://id.enyx.io/01/8991234567890/21/${code}`
    : `1899123456${code.replace(/[^0-9]/g, '').slice(-4)}`;
};

/**
 * POST /api/packaging/pack
 * Records one or more weighed units, inheriting grade and capacity from the source pallet.
 */
router.post('/pack', async (req, res): Promise<void> => {
  try {
    const rawPalletCode = req.body.sourcePalletCode || req.body.palletCode;
    const targetPalletCode = typeof rawPalletCode === 'string' ? rawPalletCode.trim().toUpperCase() : '';
    const rawPalletId = req.body.sourcePalletId || req.body.palletId;
    const targetPalletId = typeof rawPalletId === 'string' ? rawPalletId.trim() : '';
    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);
    const hasTotalWeight = req.body.totalNetWeightKg !== undefined && req.body.totalNetWeightKg !== null;
    const rawWeight = hasTotalWeight
      ? Number(req.body.totalNetWeightKg)
      : Number(req.body.weightKg) * quantity;
    const requestedFormat = typeof req.body.format === 'string' ? req.body.format.toUpperCase() : '';
    const inferredFormat = typeof req.body.packageTypeCode === 'string' && req.body.packageTypeCode.toUpperCase().includes('CARTON')
      ? 'EXPORT_CARTON'
      : 'RETAIL_POUCH';
    const packageFormat = requestedFormat || inferredFormat;

    if (packageFormat !== 'RETAIL_POUCH' && packageFormat !== 'EXPORT_CARTON') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'format must be RETAIL_POUCH or EXPORT_CARTON' },
      });
      return;
    }

    if (!Number.isFinite(rawWeight)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid totalNetWeightKg or weightKg is required' },
      });
      return;
    }

    // Resolve pallet strictly (disallow empty match)
    const palletConditions: any[] = [];
    if (targetPalletCode && typeof targetPalletCode === 'string' && targetPalletCode.trim()) {
      palletConditions.push({ code: { equals: targetPalletCode.trim(), mode: 'insensitive' } });
    }
    if (targetPalletId && typeof targetPalletId === 'string' && targetPalletId.trim()) {
      palletConditions.push({ id: targetPalletId.trim() });
    }

    if (palletConditions.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid targetPalletCode or targetPalletId is required' },
      });
      return;
    }

    const pallet = await prisma.pallet.findFirst({
      where: {
        OR: palletConditions,
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

    let allocation;
    try {
      allocation = calculatePackagingAllocation({
        quantity,
        totalNetWeightKg: rawWeight,
        remainingKg: pallet.remainingKg,
      });
    } catch (err) {
      if (err instanceof PackagingValidationError) {
        res.status(400).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
        return;
      }
      throw err;
    }

    const cartonSpec = packageFormat === 'EXPORT_CARTON'
      ? (req.body.cartonSpec === '50kg' || String(req.body.packageTypeCode || '').includes('50') ? '50kg' : '10kg')
      : null;
    const packageCodePrefix = getPackageCodePrefix(packageFormat);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const deducted = await tx.pallet.updateMany({
          where: {
            id: pallet.id,
            status: { in: ['ACTIVE', 'IN_PACKAGING'] },
            remainingKg: { gte: allocation.totalNetWeightKg },
          },
          data: {
            remainingKg: { decrement: allocation.totalNetWeightKg },
          },
        });

        if (deducted.count !== 1) {
          throw new PackagingValidationError(
            `Pallet ${pallet.code} no longer has enough remaining weight for this packaging request`,
            'INSUFFICIENT_PALLET_WEIGHT',
          );
        }

        const updatedPallet = await tx.pallet.findUnique({
          where: { id: pallet.id },
          include: {
            farmer: true,
            sortingBatch: { include: { waring: true } },
          },
        });

        if (!updatedPallet) {
          throw new PackagingValidationError('Source pallet could not be found', 'VALIDATION_ERROR');
        }

        const nextStatus = updatedPallet.remainingKg < 0.5 ? 'DEPLETED' : 'IN_PACKAGING';
        if (updatedPallet.status !== nextStatus) {
          await tx.pallet.update({
            where: { id: updatedPallet.id },
            data: { status: nextStatus },
          });
        }

        const countToday = await tx.packageUnit.count({
          where: { code: { startsWith: packageCodePrefix } },
        });
        const units = [];

        for (const [index, unitWeight] of allocation.unitWeightsKg.entries()) {
          const code = createPackageCode(packageCodePrefix, countToday + index + 1);
          const unit = await tx.packageUnit.create({
            data: {
              code,
              format: packageFormat,
              grade: pallet.grade,
              weightKg: unitWeight,
              barcode: createPackageBarcode(packageFormat, code),
              cartonSpec,
              sourcePalletId: pallet.id,
              status: 'STORED',
            },
          });
          units.push(unit);
        }

        return { units, pallet: updatedPallet };
      });

      const firstUnit = result.units[0];
      res.status(201).json({
        success: true,
        data: {
          id: firstUnit.id,
          code: firstUnit.code,
          format: firstUnit.format,
          grade: firstUnit.grade,
          weightKg: firstUnit.weightKg,
          barcode: firstUnit.barcode,
          cartonSpec: firstUnit.cartonSpec,
          quantity: result.units.length,
          totalNetWeightKg: allocation.totalNetWeightKg,
          units: result.units.map((unit) => ({
            id: unit.id,
            code: unit.code,
            weightKg: unit.weightKg,
            barcode: unit.barcode,
          })),
          sourcePalletCode: result.pallet.code,
          remainingPalletKg: result.pallet.remainingKg,
          farmerName: result.pallet.farmer.name,
          waringCode: result.pallet.sortingBatch.waring.code,
          status: firstUnit.status,
          createdAt: firstUnit.createdAt,
        },
      });
    } catch (err) {
      if (err instanceof PackagingValidationError) {
        res.status(400).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
        return;
      }
      throw err;
    }
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
