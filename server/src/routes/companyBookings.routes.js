// Rutas del panel de empresa para reservas y bloqueos de horas: listar, ver el detalle y cancelar reservas, y
// crear, listar y quitar bloqueos. Solo empresas aprobadas; cada una ve únicamente lo suyo.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/companyBookingsController.js';
import { auth } from '../middlewares/auth.js';
import { requireApprovedCompany } from '../middlewares/requireApprovedCompany.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as validator from '../validators/companyBookingsValidator.js';

const router = Router();
const guard = [auth, requireRole(ROLES.COMPANY), requireApprovedCompany];

/**
 * @openapi
 * /company/bookings:
 *   get:
 *     tags: [Empresa]
 *     summary: Lista las reservas de las salas de la empresa
 *     description: 'Reservas de la empresa del token, ordenadas por fecha e inicio ascendentes. Filtros opcionales: `desde` y `hasta` (AAAA-MM-DD, inclusive, desde <= hasta). Por defecto desde = hoy - 30 días y hasta = desde + 90 días; el rango máximo es de 366 días (también con un solo extremo) y se devuelven como mucho 500 reservas y `roomId` (debe ser una sala propia). Incluye nombre y email del cliente, nunca su id ni otros datos personales.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           example: '2026-11-01'
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           example: '2026-11-30'
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reservas de la empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       codigo:
 *                         type: string
 *                         nullable: true
 *                       roomId:
 *                         type: string
 *                       sala:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           nombre:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                       fecha:
 *                         type: string
 *                         example: '2026-11-20'
 *                       inicio:
 *                         type: integer
 *                       fin:
 *                         type: integer
 *                       horas:
 *                         type: integer
 *                       precioHora:
 *                         type: number
 *                       importe:
 *                         type: number
 *                       estado:
 *                         type: string
 *                         enum: [PENDING_PAYMENT, CONFIRMED, CANCELLED, EXPIRED, COMPLETED]
 *                       cliente:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           nombre:
 *                             type: string
 *                             nullable: true
 *                           email:
 *                             type: string
 *                             nullable: true
 *                       motivoCancelacion:
 *                         type: string
 *                       canceladaPor:
 *                         type: string
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
  '/company/bookings',
  ...guard,
  validator.list,
  validate,
  asyncHandler(ctrl.listBookings),
);

/**
 * @openapi
 * /company/bookings/{id}:
 *   get:
 *     tags: [Empresa]
 *     summary: Detalle de una reserva de una sala de la empresa
 *     description: 'Solo reservas de salas de la empresa del token (una reserva ajena responde 404 NOT_FOUND como una inexistente). Igual que el detalle del cliente más nombre y email del cliente; nunca su id ni más datos personales.'
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
 *         description: Detalle de la reserva con los datos del cliente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: {type: string}
 *                 codigo: {type: string, nullable: true, example: IP-1000}
 *                 roomId: {type: string}
 *                 sala:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id: {type: string}
 *                     codigo: {type: string, nullable: true}
 *                     nombre: {type: string, nullable: true}
 *                 planta:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id: {type: string}
 *                     nombre: {type: string, nullable: true}
 *                     nivel: {type: integer, nullable: true}
 *                 edificio:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id: {type: string}
 *                     nombre: {type: string, nullable: true}
 *                     direccion: {type: string, nullable: true}
 *                     ciudad: {type: string, nullable: true}
 *                 fecha: {type: string, format: date, example: '2030-03-12'}
 *                 inicio: {type: integer}
 *                 fin: {type: integer}
 *                 horas: {type: integer}
 *                 precioHora: {type: number}
 *                 importe: {type: number}
 *                 estado:
 *                   type: string
 *                   enum: [PENDING_PAYMENT, CONFIRMED, CANCELLED, EXPIRED, COMPLETED]
 *                 motivoCancelacion: {type: string, nullable: true, description: Solo si está cancelada}
 *                 canceladaPor: {type: string, enum: [cliente, empresa], nullable: true, description: Solo si está cancelada}
 *                 cliente:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     nombre: {type: string, nullable: true}
 *                     email: {type: string, nullable: true}
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
  '/company/bookings/:id',
  ...guard,
  ...validator.detail,
  validate,
  asyncHandler(ctrl.getBooking),
);

/**
 * @openapi
 * /company/bookings/{id}/cancel:
 *   patch:
 *     tags: [Empresa]
 *     summary: Cancela una reserva de una sala de la empresa
 *     description: 'Solo reservas CONFIRMED que no hayan empezado. Una reserva de otra empresa responde 404 como una inexistente. Libera las horas y guarda el motivo. No gestiona reembolsos: todavía no hay pago online.'
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
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: 'Mantenimiento imprevisto de la sala'
 *     responses:
 *       200:
 *         description: Reserva cancelada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 estado:
 *                   type: string
 *                   example: CANCELLED
 *                 motivo:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  '/company/bookings/:id/cancel',
  ...guard,
  validator.cancelBooking,
  validate,
  asyncHandler(ctrl.cancelBooking),
);

/**
 * @openapi
 * /company/blocks:
 *   get:
 *     tags: [Empresa]
 *     summary: Lista los bloqueos de horas de la empresa
 *     description: 'Bloqueos de la empresa del token, ordenados por fecha e inicio. Mismos filtros opcionales que las reservas: `desde`, `hasta` (por defecto hoy - 30 días y desde + 90 días; máximo 366 días, también con un solo extremo; como mucho 500 bloqueos) y `roomId` (sala propia).'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           example: '2026-11-01'
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           example: '2026-11-30'
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bloqueos de la empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bloqueos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       roomId:
 *                         type: string
 *                       sala:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           nombre:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                       fecha:
 *                         type: string
 *                         example: '2026-11-20'
 *                       inicio:
 *                         type: integer
 *                       fin:
 *                         type: integer
 *                       motivo:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/company/blocks', ...guard, validator.list, validate, asyncHandler(ctrl.listBlocks));

/**
 * @openapi
 * /company/blocks:
 *   post:
 *     tags: [Empresa]
 *     summary: Bloquea horas de una sala de la empresa
 *     description: 'Crea un bloqueo en horas enteras dentro del horario reservable (8-20), en una fecha no pasada. 409 SLOT_TAKEN si pisa una reserva confirmada u otro bloqueo.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roomId, fecha, inicio, fin, motivo]
 *             properties:
 *               roomId:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 example: '2026-11-25'
 *               inicio:
 *                 type: integer
 *                 example: 9
 *               fin:
 *                 type: integer
 *                 example: 12
 *               motivo:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 example: 'Mantenimiento'
 *     responses:
 *       201:
 *         description: Bloqueo creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 roomId:
 *                   type: string
 *                 sala:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                     codigo:
 *                       type: string
 *                 fecha:
 *                   type: string
 *                 inicio:
 *                   type: integer
 *                 fin:
 *                   type: integer
 *                 motivo:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: La franja ya está ocupada (SLOT_TAKEN)
 */
router.post(
  '/company/blocks',
  ...guard,
  validator.createBlock,
  validate,
  asyncHandler(ctrl.createBlock),
);

/**
 * @openapi
 * /company/blocks/{id}:
 *   delete:
 *     tags: [Empresa]
 *     summary: Quita un bloqueo de horas de la empresa
 *     description: 'Borra el bloqueo y libera sus horas.'
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
 *         description: Bloqueo borrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 borrado:
 *                   type: boolean
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  '/company/blocks/:id',
  ...guard,
  validator.removeBlock,
  validate,
  asyncHandler(ctrl.removeBlock),
);

export default router;
