import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/deliveries:
 *   post:
 *     tags:
 *       - Deliveries
 *     summary: Create delivery
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - truckPlate
 *               - destination
 *             properties:
 *               truckPlate:
 *                 type: string
 *               destination:
 *                 type: string
 *               driverName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Delivery created
 *   get:
 *     tags:
 *       - Deliveries
 *     summary: List all deliveries
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of deliveries
 */
router.post('/', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

router.get('/', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

export default router;
