// Rutas públicas de edificios: listado de edificios publicados y detalle con sus plantas.
import { Router } from 'express';

import { getBuilding, listBuildings } from '../controllers/buildingsController.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as buildingValidator from '../validators/buildingValidator.js';

const router = Router();

/**
 * @openapi
 * /buildings:
 *   get:
 *     tags: [Público]
 *     summary: Lista los edificios publicados
 *     description: 'No necesita token. Devuelve solo los edificios con estado PUBLISHED.'
 *     responses:
 *       200:
 *         description: Edificios publicados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   nombre:
 *                     type: string
 *                   descripcion:
 *                     type: string
 *                   direccion:
 *                     type: string
 *                   ciudad:
 *                     type: string
 *                   codigoPostal:
 *                     type: string
 *                   pais:
 *                     type: string
 *                   latitud:
 *                     type: number
 *                   longitud:
 *                     type: number
 *                   numPlantas:
 *                     type: integer
 *             example:
 *               - id: demo-building
 *                 nombre: Edificio Demo Puerta de Sevilla
 *                 descripcion: Edificio de oficinas ficticio con salas por horas, boxes y zonas comunes.
 *                 direccion: Calle Ficticia 1
 *                 ciudad: Sevilla
 *                 codigoPostal: '41001'
 *                 pais: España
 *                 latitud: 37.3891
 *                 longitud: -5.9845
 *                 numPlantas: 4
 */
router.get('/buildings', asyncHandler(listBuildings));

/**
 * @openapi
 * /buildings/{id}:
 *   get:
 *     tags: [Público]
 *     summary: Detalle de un edificio con sus plantas
 *     description: 'No necesita token. Devuelve el edificio y sus plantas publicadas con el número de salas libres en la fecha indicada. Sin fecha, hoy.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: demo-building
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
 *         description: Edificio con sus plantas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nombre:
 *                   type: string
 *                 descripcion:
 *                   type: string
 *                 direccion:
 *                   type: string
 *                 ciudad:
 *                   type: string
 *                 codigoPostal:
 *                   type: string
 *                 pais:
 *                   type: string
 *                 latitud:
 *                   type: number
 *                 longitud:
 *                   type: number
 *                 numPlantas:
 *                   type: integer
 *                 salasLibres:
 *                   type: integer
 *                 plantas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       nivel:
 *                         type: integer
 *                       salasLibres:
 *                         type: integer
 *             example:
 *               id: demo-building
 *               nombre: Edificio Demo Puerta de Sevilla
 *               descripcion: Edificio de oficinas ficticio con salas por horas, boxes y zonas comunes.
 *               direccion: Calle Ficticia 1
 *               ciudad: Sevilla
 *               codigoPostal: '41001'
 *               pais: España
 *               latitud: 37.3891
 *               longitud: -5.9845
 *               numPlantas: 4
 *               salasLibres: 9
 *               plantas:
 *                 - id: floor-0
 *                   nombre: Planta baja
 *                   nivel: 0
 *                   salasLibres: 3
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/buildings/:id', ...buildingValidator.getById, validate, asyncHandler(getBuilding));

export default router;
