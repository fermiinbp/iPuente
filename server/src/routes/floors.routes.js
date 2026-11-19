// Ruta pública del mapa de una planta con el estado de cada sala en una fecha y, opcional, hora.
import { Router } from 'express';

import { getFloor } from '../controllers/floorsController.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as floorValidator from '../validators/floorValidator.js';

const router = Router();

/**
 * @openapi
 * /floors/{id}:
 *   get:
 *     tags: [Público]
 *     summary: Mapa de una planta con el estado de sus salas
 *     description: 'No necesita token. Devuelve el plano de una planta publicada y, por cada sala, su estado ese día o, con hora, a esa hora (FREE, OCCUPIED o UNAVAILABLE). Sin fecha, hoy. Una sala sin precio figura como UNAVAILABLE. Nunca incluye quién ha reservado.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: floor-0
 *       - in: query
 *         name: fecha
 *         required: false
 *         description: Día a consultar (AAAA-MM-DD). Sin fecha, hoy.
 *         schema:
 *           type: string
 *           format: date
 *         example: '2026-06-15'
 *       - in: query
 *         name: hora
 *         required: false
 *         description: Hora de inicio a consultar (entero de 8 a 19). Sin hora, el estado es el del día completo.
 *         schema:
 *           type: integer
 *           minimum: 8
 *           maximum: 19
 *         example: 10
 *     responses:
 *       200:
 *         description: Mapa de la planta.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nombre:
 *                   type: string
 *                 nivel:
 *                   type: integer
 *                 edificioId:
 *                   type: string
 *                 fecha:
 *                   type: string
 *                   format: date
 *                 hora:
 *                   type: integer
 *                   description: Solo si se pidió una hora.
 *                 ancho:
 *                   type: number
 *                 alto:
 *                   type: number
 *                 salas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       codigo:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       tipo:
 *                         type: string
 *                       x:
 *                         type: number
 *                       y:
 *                         type: number
 *                       w:
 *                         type: number
 *                       h:
 *                         type: number
 *                       estado:
 *                         type: string
 *                         enum: [FREE, OCCUPIED, UNAVAILABLE]
 *                       capacidad:
 *                         type: integer
 *                         nullable: true
 *                       precioHora:
 *                         type: number
 *                         nullable: true
 *             example:
 *               id: floor-0
 *               nombre: Planta baja
 *               nivel: 0
 *               edificioId: demo-building
 *               fecha: '2026-06-15'
 *               ancho: 1000
 *               alto: 600
 *               salas:
 *                 - id: p0-s01
 *                   codigo: P0-S01
 *                   nombre: Sala Guadalquivir
 *                   tipo: sala
 *                   x: 300
 *                   y: 0
 *                   w: 350
 *                   h: 260
 *                   estado: FREE
 *                   capacidad: 19
 *                   precioHora: 44
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/floors/:id', ...floorValidator.getById, validate, asyncHandler(getFloor));

export default router;
