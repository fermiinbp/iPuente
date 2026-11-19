// Rutas del panel de empresa: alta, edificios, plantas, mapas (detección con IA, guardar, publicar), salas, reservas y bloqueos. Cada empresa solo accede a lo suyo.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import { getMyCompany } from '../controllers/companyController.js';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/**
 * @openapi
 * /companies/me:
 *   get:
 *     tags: [Empresa]
 *     summary: Devuelve la empresa del usuario autenticado
 *     description: Incluye su estado (`pendiente`, `aprobada` o `rechazada`). Disponible aunque la empresa aún no esté aprobada.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Empresa propia.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                   example: 'Oficinas Sevilla SL'
 *                 taxId:
 *                   type: string
 *                   example: 'B12345674'
 *                 contactName:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *                 estado:
 *                   type: string
 *                   enum: [pendiente, aprobada, rechazada]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/companies/me', auth, requireRole(ROLES.COMPANY), asyncHandler(getMyCompany));

export default router;
