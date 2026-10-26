import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

// Helper to generate sequential Delivery Code (DLV-20261026-0001)
const generateDeliveryCode = async (): Promise<string> => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `DLV-${yyyy}${mm}${dd}`;

  const countToday = await prisma.delivery.count({
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
 * GET /api/deliveries
 * Retrieves delivery manifests and dispatch orders
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const deliveries = await prisma.delivery.findMany({
      include: {
        packages: {
          select: { id: true, code: true, format: true, grade: true, weightKg: true },
        },
      },
      orderBy: { departedAt: 'desc' },
    });

    res.json({
      success: true,
      data: deliveries.map((d) => ({
        id: d.id,
        code: d.code,
        truckPlate: d.truckPlate,
        destination: d.destination,
        driverName: d.driverName,
        packageCount: d.packages.length,
        totalWeightKg: parseFloat(d.packages.reduce((sum, p) => sum + p.weightKg, 0).toFixed(2)),
        departedAt: d.departedAt,
        createdAt: d.createdAt,
        packages: d.packages,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to list deliveries' },
    });
  }
});

/**
 * POST /api/deliveries
 * Creates a truck shipment dispatch and marks packages as DISPATCHED
 */
router.post('/', async (req, res): Promise<void> => {
  try {
    const { truckPlate, destination, driverName, packageCodes, packageIds } = req.body;

    if (!truckPlate || !destination) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'truckPlate and destination are required' },
      });
      return;
    }

    const code = await generateDeliveryCode();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create delivery manifest
      const delivery = await tx.delivery.create({
        data: {
          code,
          truckPlate: truckPlate.trim().toUpperCase(),
          destination: destination.trim(),
          driverName: driverName ? driverName.trim() : 'Warehouse Driver',
          departedAt: new Date(),
        },
      });

      const targetCodes: string[] = Array.isArray(packageCodes) ? [...packageCodes] : [];
      const targetIds: string[] = Array.isArray(packageIds) ? [...packageIds] : [];
      if (Array.isArray(req.body.items)) {
        for (const it of req.body.items) {
          if (it.packageCode) targetCodes.push(it.packageCode);
          if (it.packageUnitId || it.packageId || it.id) targetIds.push(it.packageUnitId || it.packageId || it.id);
        }
      }

      // 2. Link selected packages if provided
      if (targetCodes.length > 0) {
        await tx.packageUnit.updateMany({
          where: { code: { in: targetCodes } },
          data: {
            deliveryId: delivery.id,
            status: 'DISPATCHED',
          },
        });
      }
      if (targetIds.length > 0) {
        await tx.packageUnit.updateMany({
          where: { id: { in: targetIds } },
          data: {
            deliveryId: delivery.id,
            status: 'DISPATCHED',
          },
        });
      }

      return delivery;
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to create delivery shipment' },
    });
  }
});

export default router;
