// Rutas públicas de salas: ficha y horas libres.
import { Router } from 'express';

import { getRoom, getRoomAvailability } from '../controllers/roomsController.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as roomValidator from '../validators/roomValidator.js';

const router = Router();

/**
 * @openapi
 * /rooms/{id}:
 *   get:
 *     tags: [Público]
 *     summary: Ficha de una sala
 *     description: 'No necesita token. Devuelve los datos públicos de una sala de una planta publicada: capacidad, precio, equipamiento, fotos y su ubicación. Una sala no reservable (oculta o sin precio) responde 404.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: p0-s01
 *     responses:
 *       200:
 *         description: Ficha de la sala.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 codigo:
 *                   type: string
 *                 nombre:
 *                   type: string
 *                 tipo:
 *                   type: string
 *                 descripcion:
 *                   type: string
 *                 capacidad:
 *                   type: integer
 *                 m2:
 *                   type: number
 *                 precioHora:
 *                   type: number
 *                   nullable: true
 *                 periodoPrecio:
 *                   type: string
 *                   example: HOUR
 *                 equipamiento:
 *                   type: array
 *                   items:
 *                     type: string
 *                 fotos:
 *                   type: array
 *                   items:
 *                     type: string
 *                 reservable:
 *                   type: boolean
 *                 edificio:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     direccion:
 *                       type: string
 *                     ciudad:
 *                       type: string
 *                 planta:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     nivel:
 *                       type: integer
 *             example:
 *               id: p0-s01
 *               codigo: P0-S01
 *               nombre: Sala Guadalquivir
 *               tipo: sala
 *               descripcion: ''
 *               capacidad: 19
 *               m2: 57
 *               precioHora: 44
 *               periodoPrecio: HOUR
 *               equipamiento: [wifi, pantalla, pizarra, climatizacion]
 *               fotos: []
 *               reservable: true
 *               edificio:
 *                 id: demo-building
 *                 nombre: Edificio Demo Puerta de Sevilla
 *                 direccion: Calle Ficticia 1
 *                 ciudad: Sevilla
 *               planta:
 *                 id: floor-0
 *                 nombre: Planta baja
 *                 nivel: 0
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/rooms/:id', ...roomValidator.getById, validate, asyncHandler(getRoom));

/**
 * @openapi
 * /rooms/{id}/availability:
 *   get:
 *     tags: [Público]
 *     summary: Horas libres de una sala en un día
 *     description: 'No necesita token. Devuelve las horas de inicio libres entre las 8:00 y las 20:00. Una sala no reservable (oculta o sin precio) responde 404. Sin fecha, hoy. Nunca incluye quién ha reservado.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: p0-s01
 *       - in: query
 *         name: fecha
 *         required: false
 *         description: Día a consultar (AAAA-MM-DD). Sin fecha, hoy.
 *         schema:
 *           type: string
 *           format: date
 *         example: '2026-06-15'
 *     responses:
 *       200:
 *         description: Horas libres del día.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomId:
 *                   type: string
 *                 fecha:
 *                   type: string
 *                   format: date
 *                 desde:
 *                   type: integer
 *                 hasta:
 *                   type: integer
 *                 horasLibres:
 *                   type: array
 *                   items:
 *                     type: integer
 *             example:
 *               roomId: p0-s01
 *               fecha: '2026-06-15'
 *               desde: 8
 *               hasta: 20
 *               horasLibres: [8, 11, 12, 13, 14, 15, 16, 17, 18, 19]
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/rooms/:id/availability',
  ...roomValidator.availability,
  validate,
  asyncHandler(getRoomAvailability),
);

export default router;
