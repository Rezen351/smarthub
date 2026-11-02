import { Router } from 'express';
import prisma from '../shared/database/prisma';
import bwipjs from 'bwip-js';

const router = Router();

/**
 * GET /api/labels/farmer/:farmerId
 * Returns printable label data for a farmer ID card with QR code
 */
router.get('/farmer/:farmerId', async (req, res): Promise<void> => {
  try {
    const { farmerId } = req.params;
    const query = farmerId.trim();

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [
          { id: query },
          { code: { equals: query, mode: 'insensitive' } },
        ],
      },
    });

    if (!farmer) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Farmer '${farmerId}' not found` },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        type: 'farmer',
        farmerId: farmer.id,
        farmerCode: farmer.code,
        farmerName: farmer.name,
        village: farmer.village,
        qrContent: farmer.code,
        traceabilityUrl: `https://enyx1.almuzky.my.id/traceability/${farmer.code}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Failed to generate farmer label' },
    });
  }
});

/**
 * GET /api/labels/farmer-qr/:farmerId
 * Returns QR code image for farmer ID card
 */
router.get('/farmer-qr/:farmerId', async (req, res): Promise<void> => {
  try {
    const { farmerId } = req.params;
    const query = farmerId.trim();

    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [
          { id: query },
          { code: { equals: query, mode: 'insensitive' } },
        ],
      },
    });

    if (!farmer) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Farmer '${farmerId}' not found` },
      });
      return;
    }

    // Generate QR code with farmer code
    const qrCode = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: farmer.code,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(qrCode);
  } catch (err: any) {
    console.error('QR generation error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate QR code' },
    });
  }
});

export default router;
