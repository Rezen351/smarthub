import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/labels/pouch/{pouchId}:
 *   get:
 *     tags:
 *       - Labels
 *     summary: Generate pouch label
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pouchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Label generated
 *       404:
 *         description: Pouch not found
 */
router.get('/pouch/:pouchId', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

/**
 * @swagger
 * /api/labels/packaging/{packagingId}:
 *   get:
 *     tags:
 *       - Labels
 *     summary: Generate packaging label
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packagingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Label generated
 *       404:
 *         description: Packaging not found
 */
router.get('/packaging/:packagingId', (req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' },
  });
});

export default router;
