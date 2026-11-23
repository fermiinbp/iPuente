// Rutas del panel de admin: empresas (listar, detalle, aprobar, rechazar, suspender y reactivar), usuarios, reservas, pagos y resumen.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/adminController.js';
import { authStrict } from '../middlewares/auth.js';
import { adminRefundLimiter } from '../middlewares/rateLimit.js';
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
 *     description: 'Devuelve `{ empresas: [{ id, nombre, cif, email, estado, fechaSolicitud, verificada }] }`. Solo admin; se comprueba además que el token no esté revocado (no hace falta nada nuevo en el cliente).'
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
  authStrict,
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
 *     description: 'Datos de la empresa, `estado`, `motivo`, `revisadaEn`, `dueno { nombre, email }` y `edificios [{ id, nombre, ciudad, publicado }]`. Solo admin; se comprueba además que el token no esté revocado (no hace falta nada nuevo en el cliente).'
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
  authStrict,
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
 *     description: 'PENDING pasa a APPROVED. Cualquier otro estado devuelve 400 `INVALID_TRANSITION`. Devuelve la empresa actualizada. Si se envía `version` (la del detalle) y la empresa ha cambiado desde entonces, responde 409 `STALE_DATA`.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               version:
 *                 type: string
 *                 format: date-time
 *                 description: Campo `version` del detalle de la empresa.
 *     responses:
 *       200:
 *         description: Empresa aprobada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: La empresa cambió sus datos desde que se abrió (`STALE_DATA`).
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/admin/companies/:id/approve',
  authStrict,
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
 *               version:
 *                 type: string
 *                 format: date-time
 *                 description: Opcional. Campo `version` del detalle; si ya no coincide, 409 `STALE_DATA`.
 *     responses:
 *       200:
 *         description: Empresa rechazada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: La empresa cambió sus datos desde que se abrió (`STALE_DATA`).
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/admin/companies/:id/reject',
  authStrict,
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
  authStrict,
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
  authStrict,
  requireRole(ROLES.ADMIN),
  adminValidator.reactivate,
  validate,
  asyncHandler(ctrl.reactivateCompany),
);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Lista los usuarios con búsqueda y paginación
 *     description: 'Devuelve `{ usuarios: [{ id, nombre, email, rol, empresa, fechaAlta }], total, page, limit, truncado }`, del alta más reciente al más antiguo, 20 por página (hasta 1000 usuarios leídos, página máxima 50; si `truncado` es true, `total` es «al menos» ese valor). `q` busca por nombre o email sin tildes ni mayúsculas. Solo admin.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [CLIENT, COMPANY, ADMIN]
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           maxLength: 100
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Página de usuarios.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/admin/users',
  authStrict,
  requireRole(ROLES.ADMIN),
  adminValidator.listUsers,
  validate,
  asyncHandler(ctrl.listUsers),
);

/**
 * @openapi
 * /admin/bookings:
 *   get:
 *     tags: [Admin]
 *     summary: Lista las reservas de todas las empresas
 *     description: 'Devuelve `{ reservas: [{ id, codigo, fecha, inicio, fin, importe, estado, sala, edificio, empresa, cliente }], total, page, limit, desde, hasta, truncado, desdeEfectivo }`. Rango por defecto: hoy - 30 días hasta +90 días (máximo 366 días y 500 resultados), 20 por página (página máxima 25). Si `truncado` es true, `total` es «al menos» ese valor y `desdeEfectivo` (AAAA-MM-DD) es la fecha de la reserva más antigua leída. Solo admin.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [PENDING_PAYMENT, CONFIRMED, CANCELLED, EXPIRED, COMPLETED]
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           example: '2026-06-01'
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           example: '2026-06-30'
 *       - in: query
 *         name: companyId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Página de reservas.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/admin/bookings',
  authStrict,
  requireRole(ROLES.ADMIN),
  adminValidator.listBookings,
  validate,
  asyncHandler(ctrl.listBookings),
);

/**
 * @openapi
 * /admin/bookings/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Detalle de una reserva
 *     description: 'Reserva con sala, planta, edificio, `empresa { id, nombre }` y `cliente { nombre, email }`. Solo admin.'
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
 *         description: Detalle de la reserva.
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
  '/admin/bookings/:id',
  authStrict,
  requireRole(ROLES.ADMIN),
  adminValidator.getBooking,
  validate,
  asyncHandler(ctrl.getBooking),
);

/**
 * @openapi
 * /admin/payments:
 *   get:
 *     tags: [Admin]
 *     summary: Lista los pagos con su reserva
 *     description: 'Devuelve `{ pagos: [{ id, importe, moneda, estado, reembolsoPendiente, motivoReembolso, fecha, reembolsadoEn, reserva { id, codigo, estado }, cliente { nombre, email } }], total, page, limit, truncado }`, del más reciente al más antiguo, 20 por página (hasta 500 pagos leídos, página máxima 25). `estado` es el del pago. Nunca incluye datos de tarjeta. El `id` del pago es el id de la sesión de Checkout de Stripe (clave de idempotencia del pago; no es secreto y solo lo ve el admin). Solo admin.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [PENDING, SUCCEEDED, FAILED, REFUNDED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Página de pagos.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/admin/payments',
  authStrict,
  requireRole(ROLES.ADMIN),
  adminValidator.listPayments,
  validate,
  asyncHandler(ctrl.listPayments),
);

/**
 * @openapi
 * /admin/payments/{id}/refund:
 *   post:
 *     tags: [Admin]
 *     summary: Reembolsa un pago (siempre total)
 *     description: 'Reembolsa en Stripe el pago `SUCCEEDED` (o reintenta uno con `reembolsoPendiente`), lo pasa a `REFUNDED`, cancela su reserva `CONFIRMED` (`canceladaPor: admin`) y libera sus horas; una reserva `COMPLETED` conserva su estado y su historial (`reserva.estado: COMPLETED`). El `id` del pago es el id de la sesión de Checkout de Stripe (clave de idempotencia; no es secreto y solo lo ve el admin). Es idempotente: repetir la llamada sobre un pago ya reembolsado responde 200 con `yaReembolsado: true` sin volver a llamar a Stripe. Devuelve `{ id, estado, reserva { id, estado }, yaReembolsado? }`. 409 `PAYMENT_NOT_REFUNDABLE` si el pago no está cobrado; 502 `PAYMENTS_ERROR` si Stripe falla (el reembolso queda pendiente y se puede reintentar); 503 `PAYMENTS_UNAVAILABLE` sin Stripe. Solo admin.'
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
 *         description: Pago reembolsado.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         description: Demasiados reembolsos seguidos (`RATE_LIMITED`).
 *       409:
 *         description: El pago no se puede reembolsar (`PAYMENT_NOT_REFUNDABLE`).
 *       502:
 *         description: Stripe ha fallado (`PAYMENTS_ERROR`); el reembolso queda pendiente.
 *       503:
 *         description: Pagos no disponibles (`PAYMENTS_UNAVAILABLE`).
 */
router.post(
  '/admin/payments/:id/refund',
  authStrict,
  requireRole(ROLES.ADMIN),
  adminRefundLimiter,
  adminValidator.refundPayment,
  validate,
  asyncHandler(ctrl.refundPayment),
);

/**
 * @openapi
 * /admin/summary:
 *   get:
 *     tags: [Admin]
 *     summary: Resumen del panel
 *     description: 'Devuelve `{ empresas, usuarios, reservasMes, ingresosMes }`: empresas por estado, usuarios por rol, reservas del mes actual por estado (una PENDING_PAYMENT vencida cuenta como EXPIRED; si se alcanza el tope de lectura, reservasMes.truncado es true) e ingresos del mes natural (pagos SUCCEEDED creados en el mes, sin los que tienen un reembolso pendiente; los REFUNDED no cuentan; agregación sin leer documentos). `ingresosMes` es el volumen cobrado a los clientes en el mes (el dinero va a las cuentas de las empresas), no el ingreso de la plataforma, que no cobra comisión; se mantiene el nombre de la clave por compatibilidad. Es null si no se han podido calcular; el resto del resumen responde igual. Solo admin.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ingresosMes:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Euros cobrados a los clientes en el mes (volumen cobrado, no ingreso de la plataforma).
 *                     pagos:
 *                       type: integer
 *                       description: Número de pagos contados.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/admin/summary',
  authStrict,
  requireRole(ROLES.ADMIN),
  adminValidator.summary,
  validate,
  asyncHandler(ctrl.getSummary),
);

export default router;
