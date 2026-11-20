// Rutas de reservas del cliente: crear, listar las propias, ver el detalle y cancelar. Todas exigen token.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import {
  cancelBooking,
  createBooking,
  getMyBooking,
  listMyBookings,
} from '../controllers/bookingsController.js';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as bookingValidator from '../validators/bookingValidator.js';

const router = Router();

/**
 * @openapi
 * /bookings:
 *   post:
 *     tags: [Cliente]
 *     summary: Crea una reserva
 *     description: 'Solo rol CLIENT. Reserva una franja de horas enteras (8-20) de una sala. Sin pago online: la reserva nace CONFIRMED. El importe lo calcula el servidor. Si otra reserva o un bloqueo ocupa la franja, responde 409 SLOT_TAKEN.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roomId, fecha, inicio, fin]
 *             properties:
 *               roomId:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date
 *               inicio:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 23
 *               fin:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 24
 *           example:
 *             roomId: p0-s01
 *             fecha: '2026-12-15'
 *             inicio: 10
 *             fin: 12
 *     responses:
 *       201:
 *         description: Reserva creada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 roomId:
 *                   type: string
 *                 fecha:
 *                   type: string
 *                   format: date
 *                 inicio:
 *                   type: integer
 *                 fin:
 *                   type: integer
 *                 horas:
 *                   type: integer
 *                 precioHora:
 *                   type: number
 *                 importe:
 *                   type: number
 *                 estado:
 *                   type: string
 *                   example: CONFIRMED
 *                 codigo:
 *                   type: string
 *                   example: IP-1000
 *             example:
 *               id: Qw3rTy9
 *               codigo: IP-1000
 *               roomId: p0-s01
 *               fecha: '2026-12-15'
 *               inicio: 10
 *               fin: 12
 *               horas: 2
 *               precioHora: 44
 *               importe: 88
 *               estado: CONFIRMED
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: La franja ya está ocupada (SLOT_TAKEN).
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 code: SLOT_TAKEN
 *                 message: Esa franja ya está ocupada
 */
router.post(
  '/bookings',
  auth,
  requireRole(ROLES.CLIENT),
  ...bookingValidator.create,
  validate,
  asyncHandler(createBooking),
);

/**
 * @openapi
 * /bookings/me:
 *   get:
 *     tags: [Cliente]
 *     summary: Mis reservas
 *     description: 'Devuelve las reservas del usuario autenticado: próximas (aún no han terminado, de más cercana a más lejana) y pasadas (de más reciente a más antigua).'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reservas del usuario.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proximas:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MyBooking'
 *                 pasadas:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MyBooking'
 *             example:
 *               proximas:
 *                 - id: Qw3rTy9
 *                   roomId: p0-s01
 *                   sala: { nombre: Sala Guadalquivir, codigo: P0-S01 }
 *                   fecha: '2026-12-15'
 *                   inicio: 10
 *                   fin: 12
 *                   horas: 2
 *                   precioHora: 44
 *                   importe: 88
 *                   estado: CONFIRMED
 *               pasadas: []
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/bookings/me', auth, requireRole(ROLES.CLIENT), asyncHandler(listMyBookings));

/**
 * @openapi
 * /bookings/{id}:
 *   get:
 *     tags: [Cliente]
 *     summary: Detalle de una reserva propia
 *     description: 'Solo el cliente dueño (rol CLIENT); una reserva ajena responde 404 como una inexistente. Incluye código legible, sala, planta, edificio y, si está cancelada, motivo y quién la canceló. Nunca devuelve userId ni companyId. Si la sala, planta o edificio ya no existen, esos bloques son null.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: Qw3rTy9
 *     responses:
 *       200:
 *         description: Detalle de la reserva.
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
  '/bookings/:id',
  auth,
  requireRole(ROLES.CLIENT),
  ...bookingValidator.detail,
  validate,
  asyncHandler(getMyBooking),
);

/**
 * @openapi
 * /bookings/{id}/cancel:
 *   patch:
 *     tags: [Cliente]
 *     summary: Cancela una reserva propia
 *     description: 'Solo el cliente dueño (rol CLIENT) puede cancelar una reserva CONFIRMED que no haya empezado. Libera las horas de la sala. Una reserva de otro usuario responde 404 como una inexistente.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: Qw3rTy9
 *     responses:
 *       200:
 *         description: Reserva cancelada.
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
 *             example:
 *               id: Qw3rTy9
 *               estado: CANCELLED
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
  '/bookings/:id/cancel',
  auth,
  requireRole(ROLES.CLIENT),
  ...bookingValidator.cancel,
  validate,
  asyncHandler(cancelBooking),
);

export default router;
