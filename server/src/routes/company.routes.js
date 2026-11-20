// Rutas del panel de empresa: alta, edificios, plantas, mapas (detección con IA, guardar, publicar), salas, reservas y bloqueos. Cada empresa solo accede a lo suyo.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/companyController.js';
import { auth } from '../middlewares/auth.js';
import { requireApprovedCompany } from '../middlewares/requireApprovedCompany.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as companyValidator from '../validators/companyValidator.js';

const router = Router();

/**
 * @openapi
 * /companies/me:
 *   get:
 *     tags: [Empresa]
 *     summary: Devuelve la empresa del usuario autenticado
 *     description: 'Incluye su estado (`pendiente`, `aprobada`, `rechazada` o `suspendida`) y su `motivo` (de rechazo o suspensión, o null). Disponible aunque la empresa aún no esté aprobada.'
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
router.get('/companies/me', auth, requireRole(ROLES.COMPANY), asyncHandler(ctrl.getMyCompany));

/**
 * @openapi
 * /company/buildings:
 *   get:
 *     tags: [Empresa]
 *     summary: Lista los edificios de la empresa
 *     description: 'Devuelve `{ id, nombre, direccion, ciudad, descripcion, fotos, publicado, plantas }`, donde `plantas` es `[{ id, numero, nombre, publicado, salas }]` ordenadas por número (`salas` = salas activas). Solo para empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de edificios.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/company/buildings',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  asyncHandler(ctrl.listBuildings),
);

/**
 * @openapi
 * /company/buildings:
 *   post:
 *     tags: [Empresa]
 *     summary: Crea un edificio
 *     description: 'Se crea en borrador (`publicado: false`). Obligatorios `nombre`, `direccion` y `ciudad`; opcionales `descripcion` y `fotos` (URLs https). Solo para empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Edificio creado.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/company/buildings',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.createBuilding,
  validate,
  asyncHandler(ctrl.createBuilding),
);

/**
 * @openapi
 * /company/buildings/{id}:
 *   patch:
 *     tags: [Empresa]
 *     summary: Edita un edificio propio
 *     description: 'Todos los campos son opcionales, pero hay que enviar al menos uno de `nombre`, `direccion`, `ciudad`, `descripcion` o `fotos`. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (403 si es de otra, 404 si no existe).'
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
 *         description: Edificio actualizado.
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
  '/company/buildings/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.updateBuilding,
  validate,
  asyncHandler(ctrl.updateBuilding),
);

/**
 * @openapi
 * /company/buildings/{id}/floors:
 *   post:
 *     tags: [Empresa]
 *     summary: Crea una planta en un edificio propio
 *     description: 'Body `{ numero, nombre }` (`numero` entero de -10 a 200; 0 o negativo para sótanos). Se crea en borrador sin salas. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (403 si es de otra, 404 si no existe).'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: 'Planta creada: `{ id, buildingId, numero, nombre, publicado }`.'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 'Ya existe una planta con ese número en el edificio (`FLOOR_EXISTS`).'
 */
router.post(
  '/company/buildings/:id/floors',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.createFloor,
  validate,
  asyncHandler(ctrl.createFloor),
);

/**
 * @openapi
 * /company/floors/{id}:
 *   patch:
 *     tags: [Empresa]
 *     summary: Edita una planta propia
 *     description: 'Body con `numero` y/o `nombre` (al menos uno). Solo para empresas aprobadas; cada empresa solo accede a lo suyo (403 si es de otra, 404 si no existe).'
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
 *         description: Planta actualizada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 'Ya existe una planta con ese número en el edificio (`FLOOR_EXISTS`).'
 */
router.patch(
  '/company/floors/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.updateFloor,
  validate,
  asyncHandler(ctrl.updateFloor),
);

/**
 * @openapi
 * /company/rooms/{id}:
 *   patch:
 *     tags: [Empresa]
 *     summary: Edita los datos comerciales de una sala propia
 *     description: 'Campos opcionales (al menos uno): `nombre`, `capacidad`, `m2`, `precioHora`, `equipamiento`, `reservable`, `fotos`. Devuelve `{ id, floorId, buildingId, codigo, nombre, capacidad, m2, precioHora, equipamiento, reservable, fotos }`. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (403 si es de otra, 404 si no existe). Una sala que ya no está en el mapa da `ROOM_INACTIVE` (400).'
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
 *         description: Sala actualizada.
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
  '/company/rooms/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.updateRoom,
  validate,
  asyncHandler(ctrl.updateRoom),
);

/**
 * @openapi
 * /company/buildings/{id}/publish:
 *   post:
 *     tags: [Empresa]
 *     summary: Publica un edificio propio
 *     description: 'Requiere al menos una planta publicada (`NO_PUBLISHED_FLOORS`). Es idempotente. Solo para empresas aprobadas; ajeno 403, inexistente 404.'
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
 *         description: 'Edificio publicado (`publicado: true`).'
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
  '/company/buildings/:id/publish',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.buildingIdOnly,
  validate,
  asyncHandler(ctrl.publishBuilding),
);

/**
 * @openapi
 * /company/buildings/{id}/unpublish:
 *   post:
 *     tags: [Empresa]
 *     summary: Vuelve un edificio propio a borrador
 *     description: 'Es idempotente. Si hay reservas futuras (CONFIRMED o PENDING_PAYMENT) en sus salas, no se bloquea: se devuelven `reservasFuturas` y un `aviso`. Solo para empresas aprobadas; ajeno 403, inexistente 404.'
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
 *         description: 'Edificio en borrador (`publicado: false`) con `reservasFuturas` y `aviso` opcional.'
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
  '/company/buildings/:id/unpublish',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.buildingIdOnly,
  validate,
  asyncHandler(ctrl.unpublishBuilding),
);

/**
 * @openapi
 * /company/rooms:
 *   get:
 *     tags: [Empresa]
 *     summary: Lista las salas de la empresa con su estado
 *     description: 'Solo salas activas, ordenadas por edificio, planta y código. Cada una incluye `estado`: `sin_precio` (sin precio mayor que 0), `publicada` (con precio y reservable) u `oculta`. Si se pasa `buildingId` o `floorId` deben ser propios (403 si son de otra empresa, 404 si no existen). Solo para empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: buildingId
 *         schema:
 *           type: string
 *       - in: query
 *         name: floorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [publicada, sin_precio, oculta]
 *     responses:
 *       200:
 *         description: 'Lista de salas con `id, floorId, buildingId, codigo, nombre, capacidad, m2, precioHora, equipamiento, reservable, fotos, estado`.'
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
  '/company/rooms',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.listRooms,
  validate,
  asyncHandler(ctrl.listRooms),
);

/**
 * @openapi
 * /company/rooms/{id}/visibility:
 *   patch:
 *     tags: [Empresa]
 *     summary: Muestra u oculta una sala propia
 *     description: 'Body `{ visible }` (booleano). Mostrar una sala sin precio mayor que 0 da `ROOM_WITHOUT_PRICE`; una sala que ya no está en el mapa da `ROOM_INACTIVE`. Con `visible: false` y reservas futuras (CONFIRMED o PENDING_PAYMENT) se devuelven `reservasFuturas` y un `aviso`; no se bloquea. Solo para empresas aprobadas; ajena 403, inexistente 404.'
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
 *             required: [visible]
 *             properties:
 *               visible:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 'Sala con su `estado` (y `reservasFuturas` y `aviso` opcional si `visible: false`).'
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
  '/company/rooms/:id/visibility',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.setRoomVisibility,
  validate,
  asyncHandler(ctrl.setRoomVisibility),
);

export default router;
