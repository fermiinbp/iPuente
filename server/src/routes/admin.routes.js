// Rutas del panel de admin: empresas (listar, detalle, aprobar, rechazar, suspender y reactivar), usuarios, reservas, pagos y reembolsos.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/adminController.js';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as adminValidator from '../validators/adminValidator.js';

const router = Router();

/**
 * @openapi
 * /admin/companies:
 *   get:
 *     tags: [Admin]
 *     summary: Lista las empresas, de la más reciente a la más antigua
 *     description: 'Devuelve `{ empresas: [{ id, nombre, cif, email, estado, fechaSolicitud, verificada }] }`. Solo admin.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, aprobada, rechazada, suspendida]
 *     responses:
 *       200:
 *         description: Lista de empresas.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/admin/companies',
  auth,
  requireRole(ROLES.ADMIN),
  adminValidator.list,
  validate,
  asyncHandler(ctrl.listCompanies),
);

/**
 * @openapi
 * /admin/companies/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Detalle de una empresa
 *     description: 'Datos de la empresa, `estado`, `motivo`, `revisadaEn`, `dueno { nombre, email }` y `edificios [{ id, nombre, ciudad, publicado }]`. Solo admin.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle de la empresa.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/admin/companies/:id',
  auth,
  requireRole(ROLES.ADMIN),
  adminValidator.idParam,
  validate,
  asyncHandler(ctrl.getCompany),
);

/**
 * @openapi
 * /admin/companies/{id}/approve:
 *   post:
 *     tags: [Admin]
 *     summary: Aprueba una empresa pendiente
 *     description: 'PENDING pasa a APPROVED. Cualquier otro estado devuelve 400 `INVALID_TRANSITION`. Devuelve la empresa actualizada.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Empresa aprobada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/admin/companies/:id/approve',
  auth,
  requireRole(ROLES.ADMIN),
  adminValidator.approve,
  validate,
  asyncHandler(ctrl.approveCompany),
);

/**
 * @openapi
 * /admin/companies/{id}/reject:
 *   post:
 *     tags: [Admin]
 *     summary: Rechaza una empresa pendiente
 *     description: 'PENDING pasa a REJECTED y se guarda el motivo (3 a 500 caracteres). Cualquier otro estado devuelve 400 `INVALID_TRANSITION`.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [motivo]
 *             properties:
 *               motivo:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Empresa rechazada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/admin/companies/:id/reject',
  auth,
  requireRole(ROLES.ADMIN),
  adminValidator.reject,
  validate,
  asyncHandler(ctrl.rejectCompany),
);

/**
 * @openapi
 * /admin/companies/{id}/suspend:
 *   post:
 *     tags: [Admin]
 *     summary: Suspende una empresa aprobada
 *     description: 'APPROVED pasa a SUSPENDED con motivo (3 a 500 caracteres). Sus edificios dejan de verse en la API pública. Las reservas futuras no se tocan: la respuesta incluye `reservasFuturas` y `aviso`.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [motivo]
 *             properties:
 *               motivo:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Empresa suspendida.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/admin/companies/:id/suspend',
  auth,
  requireRole(ROLES.ADMIN),
  adminValidator.suspend,
  validate,
  asyncHandler(ctrl.suspendCompany),
);

/**
 * @openapi
 * /admin/companies/{id}/reactivate:
 *   post:
 *     tags: [Admin]
 *     summary: Reactiva una empresa suspendida
 *     description: 'SUSPENDED pasa a APPROVED y sus edificios vuelven a verse. El motivo de la suspensión se guarda en `lastSuspensionReason`.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Empresa reactivada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/admin/companies/:id/reactivate',
  auth,
  requireRole(ROLES.ADMIN),
  adminValidator.reactivate,
  validate,
  asyncHandler(ctrl.reactivateCompany),
);

export default router;
