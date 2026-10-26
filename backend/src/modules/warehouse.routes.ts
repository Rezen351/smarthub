import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

/**
 * GET /api/warehouse/overview
 * Returns dual-zone warehouse analytics: Buffer Zone (Raw Warings) & Finished Goods Zone
 */
router.get('/overview', async (req, res): Promise<void> => {
  try {
    // 1. Buffer Warehouse Zone (Raw intake warings awaiting sorting)
    const bufferWarings = await prisma.waring.findMany({
      where: { status: 'APPROVED' },
      include: {
        farmer: { select: { name: true, code: true, village: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const bufferTotalKg = bufferWarings.reduce((sum, w) => sum + w.netWeightKg, 0);

    // 2. Active Graded Pallets (Station 02 staging area)
    const activePallets = await prisma.pallet.findMany({
      where: { status: 'ACTIVE' },
      include: {
        farmer: { select: { name: true, code: true } },
      },
    });

    const palletStaging = {
      gradeA_Kg: activePallets.filter((p) => p.grade === 'A').reduce((sum, p) => sum + p.remainingKg, 0),
      gradeB_Kg: activePallets.filter((p) => p.grade === 'B').reduce((sum, p) => sum + p.remainingKg, 0),
      gradeC_Kg: activePallets.filter((p) => p.grade === 'C').reduce((sum, p) => sum + p.remainingKg, 0),
      totalCount: activePallets.length,
    };

    // 3. Finished Goods Warehouse Zone (Stored pouches & cartons ready for dispatch)
    const storedUnits = await prisma.packageUnit.findMany({
      where: { status: 'STORED' },
      orderBy: { createdAt: 'desc' },
    });

    const pouchUnits = storedUnits.filter((u) => u.format === 'RETAIL_POUCH');
    const cartonUnits = storedUnits.filter((u) => u.format === 'EXPORT_CARTON');

    const finishedGoods = {
      totalUnits: storedUnits.length,
      pouchCount: pouchUnits.length,
      cartonCount: cartonUnits.length,
      totalWeightKg: storedUnits.reduce((sum, u) => sum + u.weightKg, 0),
      byGrade: {
        A: storedUnits.filter((u) => u.grade === 'A').length,
        B: storedUnits.filter((u) => u.grade === 'B').length,
        C: storedUnits.filter((u) => u.grade === 'C').length,
      },
    };

    res.json({
      success: true,
      data: {
        bufferZone: {
          waringCount: bufferWarings.length,
          totalWeightKg: parseFloat(bufferTotalKg.toFixed(2)),
          totalRawStockKg: parseFloat(bufferTotalKg.toFixed(2)),
          warings: bufferWarings.map((w) => ({
            id: w.id,
            code: w.code,
            farmerName: w.farmer.name,
            farmerVillage: w.farmer.village,
            grossWeightKg: w.grossWeightKg,
            netWeightKg: w.netWeightKg,
            approvedAt: w.approvedAt,
          })),
        },
        palletStaging,
        finishedGoodsZone: {
          ...finishedGoods,
          totalFinishedPackages: finishedGoods.totalUnits,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to fetch warehouse overview' },
    });
  }
});

export default router;
