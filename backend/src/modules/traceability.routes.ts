import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

/**
 * GET /api/traceability/:code
 * Resolves full farm-to-fork traceability lineage for any package code, pallet QR, or waring code
 */
router.get('/:code', async (req, res): Promise<void> => {
  try {
    const rawCode = req.params.code.trim();

    // 1. Try to find as a Package Unit (Retail Pouch or Export Carton)
    const pkg = await prisma.packageUnit.findFirst({
      where: {
        OR: [
          { code: { equals: rawCode, mode: 'insensitive' } },
          { barcode: { equals: rawCode, mode: 'insensitive' } },
          { barcode: { contains: rawCode, mode: 'insensitive' } },
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
        delivery: true,
      },
    });

    if (pkg) {
      const pallet = pkg.sourcePallet;
      const batch = pallet.sortingBatch;
      const waring = batch.waring;
      const farmer = pallet.farmer;

      res.json({
        success: true,
        data: {
          traceType: 'PACKAGE',
          type: 'PACKAGE',
          farmer: {
            name: farmer.name,
            code: farmer.code,
            village: farmer.village,
          },
          waring: {
            code: waring.code,
            grossWeightKg: waring.grossWeightKg,
            netWeightKg: waring.netWeightKg,
          },
          package: {
            code: pkg.code,
            format: pkg.format,
            grade: pkg.grade,
            weightKg: pkg.weightKg,
            barcode: pkg.barcode,
            cartonSpec: pkg.cartonSpec,
            packedAt: pkg.createdAt,
            status: pkg.status,
          },
          pallet: {
            code: pallet.code,
            grade: pallet.grade,
            initialWeightKg: pallet.weightKg,
            status: pallet.status,
          },
          sorting: {
            batchId: batch.id,
            sizerFed: batch.sizerFed,
            washDecision: batch.washDecision,
            sortedAt: batch.sortedAt,
            shrinkagePct: batch.shrinkagePct,
          },
          intake: {
            waringCode: waring.code,
            grossWeightKg: waring.grossWeightKg,
            netWeightKg: waring.netWeightKg,
            receivedAt: waring.createdAt,
            commodity: waring.commodity.name,
          },
          origin: {
            farmerCode: farmer.code,
            farmerName: farmer.name,
            village: farmer.village,
            address: farmer.address,
          },
          dispatch: pkg.delivery
            ? {
                deliveryCode: pkg.delivery.code,
                truckPlate: pkg.delivery.truckPlate,
                destination: pkg.delivery.destination,
                driverName: pkg.delivery.driverName,
                departedAt: pkg.delivery.departedAt,
              }
            : null,
        },
      });
      return;
    }

    // 2. Try to find as a Pallet (PLT-GRD-...)
    const pallet = await prisma.pallet.findFirst({
      where: {
        code: { equals: rawCode, mode: 'insensitive' },
      },
      include: {
        farmer: true,
        sortingBatch: {
          include: {
            waring: {
              include: { commodity: true },
            },
          },
        },
        packages: true,
      },
    });

    if (pallet) {
      const batch = pallet.sortingBatch;
      const waring = batch.waring;
      const farmer = pallet.farmer;

      res.json({
        success: true,
        data: {
          traceType: 'PALLET',
          pallet: {
            code: pallet.code,
            grade: pallet.grade,
            initialWeightKg: pallet.weightKg,
            remainingKg: pallet.remainingKg,
            status: pallet.status,
            createdAt: pallet.createdAt,
          },
          sorting: {
            washDecision: batch.washDecision,
            sortedAt: batch.sortedAt,
          },
          intake: {
            waringCode: waring.code,
            grossWeightKg: waring.grossWeightKg,
            receivedAt: waring.createdAt,
            commodity: waring.commodity.name,
          },
          origin: {
            farmerCode: farmer.code,
            farmerName: farmer.name,
            village: farmer.village,
          },
          packagesProduced: pallet.packages.length,
        },
      });
      return;
    }

    // 3. Try to find as an intake Waring (WRG-...)
    const waring = await prisma.waring.findFirst({
      where: {
        code: { equals: rawCode, mode: 'insensitive' },
      },
      include: {
        farmer: true,
        commodity: true,
        sortingBatch: {
          include: { pallets: true },
        },
      },
    });

    if (waring) {
      res.json({
        success: true,
        data: {
          traceType: 'WARING',
          waring: {
            code: waring.code,
            grossWeightKg: waring.grossWeightKg,
            netWeightKg: waring.netWeightKg,
            status: waring.status,
            receivedAt: waring.createdAt,
            approvedAt: waring.approvedAt,
          },
          origin: {
            farmerCode: waring.farmer.code,
            farmerName: waring.farmer.name,
            village: waring.farmer.village,
          },
          sortedBatch: waring.sortingBatch
            ? {
                washDecision: waring.sortingBatch.washDecision,
                sortedAt: waring.sortingBatch.sortedAt,
                pallets: waring.sortingBatch.pallets.map((p) => p.code),
              }
            : null,
        },
      });
      return;
    }

    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Traceability record for code '${rawCode}' not found` },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Traceability lookup failed' },
    });
  }
});

export default router;
