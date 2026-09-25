import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/weighing:
 *   post:
 *     tags:
 *       - Weighing
 *     summary: Record weighing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - palletId
 *               - gradeId
 *               - weightKg
 *             properties:
 *               palletId:
 *                 type: string
 *               gradeId:
 *                 type: string
 *               weightKg:
 *                 type: number
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Weighing recorded
 */
router.post('/', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

/**
 * @swagger
 * /api/grades:
 *   get:
 *     tags:
 *       - Weighing
 *     summary: List all grades
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of grades
 */
router.get('/grades', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

/**
 * @swagger
 * /api/weighing/transport:
 *   get:
 *     tags:
 *       - Weighing
 *     summary: Get transport configuration
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transport configuration
 */
router.get('/transport', (req, res) => {
  res.json({
    success: true,
    data: {
      transportMode: 'wifi',
      wifiMode: 1,
      ssid: '',
      staConnected: false,
      ethernetActive: false,
      ethernetIp: '',
      apSsid: 'ENYX-SMARTHUB-AP',
      apIp: '192.168.4.1',
    },
  });
});

/**
 * @swagger
 * /api/weighing/transport:
 *   post:
 *     tags:
 *       - Weighing
 *     summary: Set transport configuration
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mode
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [wifi, ethernet]
 *     responses:
 *       200:
 *         description: Transport configuration saved
 */
router.post('/transport', (req, res) => {
  const mode = req.body.mode;
  if (!mode || (mode !== 'wifi' && mode !== 'ethernet')) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TRANSPORT_MODE', message: 'Transport mode must be wifi or ethernet' },
    });
  }
  res.json({
    success: true,
    message: `Transport mode saved: ${mode}. Applying...`,
  });
});

export default router;
