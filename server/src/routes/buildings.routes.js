// Rutas públicas de edificios: buscador de edificios publicados y detalle con sus plantas.
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
 *     summary: Busca edificios publicados con salas que encajan
 *     description: 'No necesita token. Devuelve solo edificios PUBLISHED con al menos una sala reservable (planta publicada, precio mayor que 0) que cumpla todos los filtros. Todos los parámetros son opcionales.'
 *     parameters:
 *       - in: query
 *         name: ciudad
 *         description: Texto que debe contener la ciudad (sin distinguir mayúsculas ni tildes).
 *         schema:
 *           type: string
 *           maxLength: 100
 *         example: malaga
 *       - in: query
 *         name: personas
 *         description: Capacidad mínima de la sala.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *       - in: query
 *         name: equipamiento
 *         description: Equipamiento separado por comas; la sala debe tenerlo todo (hasta 30).
 *         schema:
 *           type: string
 *         example: wifi,pantalla
 *       - in: query
 *         name: fecha
 *         description: Día (AAAA-MM-DD); solo salas con alguna hora libre ese día.
 *         schema:
 *           type: string
 *           format: date
 *         example: '2026-06-15'
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [sala, box]
 *       - in: query
 *         name: precioMax
 *         description: Precio máximo por hora.
 *         schema:
 *           type: number
 *           exclusiveMinimum: 0
 *           maximum: 10000
 *       - in: query
 *         name: orden
 *         description: 'precio (por defecto) ordena por precio desde; salas, por más salas primero.'
 *         schema:
 *           type: string
 *           enum: [precio, salas]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Página de edificios que encajan. Sin `fecha` lleva `Cache-Control public, max-age=30`.
 *         headers:
 *           Cache-Control:
 *             description: Solo presente cuando no se envía `fecha`.
 *             schema:
 *               type: string
 *               example: public, max-age=30
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 edificios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       descripcion:
 *                         type: string
 *                       direccion:
 *                         type: string
 *                       ciudad:
 *                         type: string
 *                       codigoPostal:
 *                         type: string
 *                       pais:
 *                         type: string
 *                       latitud:
 *                         type: number
 *                       longitud:
 *                         type: number
 *                       numPlantas:
 *                         type: integer
 *                       foto:
 *                         type: string
 *                         nullable: true
 *                       salasDisponibles:
 *                         type: integer
 *                       precioDesde:
 *                         type: number
 *                 total:
 *                   type: integer
 *                   description: Edificios que encajan antes de paginar.
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *             example:
 *               edificios:
 *                 - id: demo-building
 *                   nombre: Edificio Demo Puerta de Sevilla
 *                   descripcion: Edificio de oficinas ficticio.
 *                   direccion: Calle Ficticia 1
 *                   ciudad: Sevilla
 *                   codigoPostal: '41001'
 *                   pais: España
 *                   latitud: 37.3891
 *                   longitud: -5.9845
 *                   numPlantas: 4
 *                   foto: null
 *                   salasDisponibles: 5
 *                   precioDesde: 15
 *               total: 1
 *               page: 1
 *               limit: 20
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/buildings', ...buildingValidator.search, validate, asyncHandler(listBuildings));

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
