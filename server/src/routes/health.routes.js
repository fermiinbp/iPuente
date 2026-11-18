// Ruta de salud de la API: comprueba que el servidor responde. Sirve de ejemplo de comentario @openapi para el resto de rutas.
import { Router } from 'express';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Público]
 *     summary: Comprueba que la API está en marcha
 *     description: 'No necesita token. Responde siempre `{ ok: true }` si el servidor funciona.'
 *     responses:
 *       200:
 *         description: La API está en marcha.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

export default router;
