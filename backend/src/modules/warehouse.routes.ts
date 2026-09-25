import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/warehouse:
 *   get:
 *     tags:
 *       - Warehouse
 *     summary: Get warehouse status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Warehouse status per commodity
 *   post:
 *     tags:
 *       - Warehouse
 *     summary: Record stock in
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Stock in recorded
 */
router.get('/', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

router.post('/in', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

export default router;
