import { Router } from 'express';
import prisma from '../shared/database/prisma';

const router = Router();

/**
 * GET /api/sorting/queue
 * Retrieves warings in the buffer warehouse awaiting sorting (APPROVED status)
 */
router.get('/queue', async (req, res): Promise<void> => {
  try {
    const queue = await prisma.waring.findMany({
      where: { status: 'APPROVED' },
      include: {
        farmer: {
          select: { id: true, code: true, name: true, village: true },
        },
      },
      orderBy: { createdAt: 'asc' }, // FIFO queue
    });

    res.json({
      success: true,
      data: queue.map((w) => ({
        id: w.id,
        code: w.code,
        farmerId: w.farmer.code,
        farmerCode: w.farmer.code,
        farmerName: w.farmer.name,
        farmerVillage: w.farmer.village,
        grossWeightKg: w.grossWeightKg,
        netWeightKg: w.netWeightKg,
        approvedAt: w.approvedAt,
        createdAt: w.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to fetch buffer queue' },
    });
  }
});

/**
 * POST /api/sorting/process
 * Commits a completed sorting session (sizing, washing, grade weights, and pallet creation)
 */
router.post('/process', async (req, res): Promise<void> => {
  try {
    const {
      waringId,
      waringCode,
      sizerFed = true,
      washDecision,
      washingRecord,
      gradeAPalletQr,
      gradeBPalletQr,
      gradeCPalletQr,
    } = req.body;

    let aKg = Number(req.body.gradeA_Kg || 0);
    let bKg = Number(req.body.gradeB_Kg || 0);
    let cKg = Number(req.body.gradeC_Kg || 0);
    let palA = gradeAPalletQr;
    let palB = gradeBPalletQr;
    let palC = gradeCPalletQr;

    if (Array.isArray(req.body.grades)) {
      for (const g of req.body.grades) {
        const code = (g.gradeCode || g.grade || '').toUpperCase();
        const wt = Number(g.weightKg || g.kg || 0);
        if (code === 'A') {
          aKg = wt;
          if (g.palletCode) palA = g.palletCode;
        } else if (code === 'B') {
          bKg = wt;
          if (g.palletCode) palB = g.palletCode;
        } else if (code === 'C') {
          cKg = wt;
          if (g.palletCode) palC = g.palletCode;
        }
      }
    }

    const wash = (washDecision || washingRecord || 'UNWASHED').toUpperCase() === 'WASHED' ? 'WASHED' : 'UNWASHED';

    // Resolve waring strictly (disallow empty match)
    const waringConditions: any[] = [];
    if (waringId && typeof waringId === 'string' && waringId.trim()) {
      waringConditions.push({ id: waringId.trim() });
    }
    if (waringCode && typeof waringCode === 'string' && waringCode.trim()) {
      waringConditions.push({ code: { equals: waringCode.trim(), mode: 'insensitive' } });
    }

    if (waringConditions.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid waringId or waringCode is required' },
      });
      return;
    }

    const waring = await prisma.waring.findFirst({
      where: {
        OR: waringConditions,
      },
      include: { farmer: true },
    });

    if (!waring) {
      res.status(404).json({
        success: false,
        error: { code: 'WARING_NOT_FOUND', message: 'Waring sack not found' },
      });
      return;
    }

    if (waring.status === 'SORTED') {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_SORTED', message: `Waring ${waring.code} has already been sorted` },
      });
      return;
    }

    const parsedAKg = parseFloat(Number(aKg).toFixed(2));
    const parsedBKg = parseFloat(Number(bKg).toFixed(2));
    const parsedCKg = parseFloat(Number(cKg).toFixed(2));
    const commercialTotal = parseFloat((parsedAKg + parsedBKg + parsedCKg).toFixed(2));

    const shrinkageKg = parseFloat(Math.max(0, waring.grossWeightKg - commercialTotal).toFixed(2));
    const shrinkagePct = waring.grossWeightKg > 0
      ? parseFloat(((shrinkageKg / waring.grossWeightKg) * 100).toFixed(1))
      : 0;

    // Transaction to create sorting batch, create/link pallets, and update waring status
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create sorting batch
      const batch = await tx.sortingBatch.create({
        data: {
          waringId: waring.id,
          sizerFed: Boolean(sizerFed),
          washDecision: wash,
          gradeA_Kg: parsedAKg,
          gradeB_Kg: parsedBKg,
          gradeC_Kg: parsedCKg,
          shrinkageKg,
          shrinkagePct,
        },
      });

      // 2. Helper to determine sequential Pallet code
      const getPalletCode = async (grade: string, customQr?: string) => {
        if (customQr && customQr.trim()) return customQr.trim().toUpperCase();
        const existingCount = await tx.pallet.count({
          where: { grade },
        });
        const seq = String(existingCount + 1).padStart(2, '0');
        return `PLT-GRD-${grade}-${seq}`;
      };

      const palletACode = await getPalletCode('A', palA);
      const palletBCode = await getPalletCode('B', palB);
      const palletCCode = await getPalletCode('C', palC);

      // 3. Upsert / create pallets for each grade
      const createdPallets = await Promise.all([
        tx.pallet.upsert({
          where: { code: palletACode },
          update: {
            weightKg: { increment: aKg },
            remainingKg: { increment: aKg },
            status: 'ACTIVE',
          },
          create: {
            code: palletACode,
            grade: 'A',
            farmerId: waring.farmerId,
            sortingBatchId: batch.id,
            weightKg: aKg,
            remainingKg: aKg,
            status: 'ACTIVE',
          },
        }),
        tx.pallet.upsert({
          where: { code: palletBCode },
          update: {
            weightKg: { increment: bKg },
            remainingKg: { increment: bKg },
            status: 'ACTIVE',
          },
          create: {
            code: palletBCode,
            grade: 'B',
            farmerId: waring.farmerId,
            sortingBatchId: batch.id,
            weightKg: bKg,
            remainingKg: bKg,
            status: 'ACTIVE',
          },
        }),
        tx.pallet.upsert({
          where: { code: palletCCode },
          update: {
            weightKg: { increment: cKg },
            remainingKg: { increment: cKg },
            status: 'ACTIVE',
          },
          create: {
            code: palletCCode,
            grade: 'C',
            farmerId: waring.farmerId,
            sortingBatchId: batch.id,
            weightKg: cKg,
            remainingKg: cKg,
            status: 'ACTIVE',
          },
        }),
      ]);

      // 4. Mark waring as SORTED
      await tx.waring.update({
        where: { id: waring.id },
        data: { status: 'SORTED' },
      });

      return { batch, pallets: createdPallets };
    });

    res.status(201).json({
      success: true,
      data: {
        batchId: result.batch.id,
        waringCode: waring.code,
        farmerName: waring.farmer.name,
        grossWeightKg: waring.grossWeightKg,
        washDecision: result.batch.washDecision,
        grades: {
          A: { kg: parsedAKg, pallet: result.pallets[0].code },
          B: { kg: parsedBKg, pallet: result.pallets[1].code },
          C: { kg: parsedCKg, pallet: result.pallets[2].code },
        },
        pallets: result.pallets,
        commercialYieldKg: commercialTotal,
        shrinkageKg,
        shrinkagePct,
        sortedAt: result.batch.sortedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to process sorting session' },
    });
  }
});

/**
 * GET /api/sorting/batches
 * Returns history of sorting batches
 */
router.get('/batches', async (req, res): Promise<void> => {
  try {
    const batches = await prisma.sortingBatch.findMany({
      include: {
        waring: {
          include: { farmer: true },
        },
        pallets: true,
      },
      orderBy: { sortedAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: batches.map((b) => ({
        id: b.id,
        waringCode: b.waring.code,
        farmerName: b.waring.farmer.name,
        grossWeightKg: b.waring.grossWeightKg,
        washDecision: b.washDecision,
        gradeA_Kg: b.gradeA_Kg,
        gradeB_Kg: b.gradeB_Kg,
        gradeC_Kg: b.gradeC_Kg,
        shrinkageKg: b.shrinkageKg,
        shrinkagePct: b.shrinkagePct,
        pallets: b.pallets.map((p) => p.code),
        sortedAt: b.sortedAt,
        createdAt: b.sortedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to list sorting batches' },
    });
  }
});

export default router;
