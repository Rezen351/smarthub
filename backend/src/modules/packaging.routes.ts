import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/packaging/types:
 *   get:
 *     tags:
 *       - Packaging
 *     summary: List packaging types
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of packaging types
 *   post:
 *     tags:
 *       - Packaging
 *     summary: Create packaging type
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
 *         description: Packaging type created
 */
router.get('/types', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

router.post('/types', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

export default router;
