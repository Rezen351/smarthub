import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

/**
 * GET /api/labels/pouch/:pouchId
 * Returns printable label data for a retail pouch
 */
router.get('/pouch/:pouchId', async (req, res): Promise<void> => {
  try {
    const { pouchId } = req.params;
    const query = pouchId.trim();

    const unit = await prisma.packageUnit.findFirst({
      where: {
        OR: [
          { id: query },
          { code: { equals: query, mode: 'insensitive' } },
        ],
      },
      include: {
        sourcePallet: {
          include: {
            farmer: true,
            sortingBatch: {
              include: {
                waring: {
                  include: { commodity: true },
                },
              },
            },
          },
        },
      },
    });

    if (!unit) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Pouch '${pouchId}' not found` },
      });
      return;
    }

    const pallet = unit.sourcePallet;
    const batch = pallet.sortingBatch;
    const waring = batch.waring;
    const farmer = pallet.farmer;

    res.json({
      success: true,
      data: {
        type: 'pouch',
        code: unit.code,
        barcode: unit.barcode,
        format: unit.format,
        grade: unit.grade,
        weightKg: unit.weightKg,
        commodity: waring.commodity.name,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        village: farmer.village,
        sourcePalletCode: pallet.code,
        packedAt: unit.createdAt,
        traceabilityUrl: `https://enyx1.almuzky.my.id/traceability/${unit.code}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to generate pouch label' },
    });
  }
});

/**
 * GET /api/labels/packaging/:packagingId
 * Returns printable label data for any packaging unit (pouch or export carton)
 */
router.get('/packaging/:packagingId', async (req, res): Promise<void> => {
  try {
    const { packagingId } = req.params;
    const query = packagingId.trim();

    const unit = await prisma.packageUnit.findFirst({
      where: {
        OR: [
          { id: query },
          { code: { equals: query, mode: 'insensitive' } },
          { barcode: { equals: query, mode: 'insensitive' } },
        ],
      },
      include: {
        sourcePallet: {
          include: {
            farmer: true,
            sortingBatch: {
              include: {
                waring: {
                  include: { commodity: true },
                },
              },
            },
          },
        },
      },
    });

    if (!unit) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Packaging unit '${packagingId}' not found` },
      });
      return;
    }

    const pallet = unit.sourcePallet;
    const batch = pallet.sortingBatch;
    const waring = batch.waring;
    const farmer = pallet.farmer;

    res.json({
      success: true,
      data: {
        type: unit.format === 'RETAIL_POUCH' ? 'pouch' : 'export',
        code: unit.code,
        barcode: unit.barcode,
        format: unit.format,
        cartonSpec: unit.cartonSpec,
        grade: unit.grade,
        weightKg: unit.weightKg,
        commodity: waring.commodity.name,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        village: farmer.village,
        sourcePalletCode: pallet.code,
        packedAt: unit.createdAt,
        traceabilityUrl: `https://enyx1.almuzky.my.id/traceability/${unit.code}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to generate packaging label' },
    });
  }
});

export default router;
