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
 *     description: 'Incluye su estado (`pendiente`, `aprobada` o `rechazada`). Disponible aunque la empresa aún no esté aprobada.'
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
 *     description: 'Devuelve `{ id, nombre, direccion, ciudad, descripcion, fotos, publicado }`. Solo para empresas aprobadas.'
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
 *     description: 'Campos opcionales (al menos uno): `nombre`, `capacidad`, `m2`, `precioHora`, `equipamiento`, `reservable`, `fotos`. Devuelve `{ id, floorId, buildingId, codigo, nombre, capacidad, m2, precioHora, equipamiento, reservable, fotos }`. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (403 si es de otra, 404 si no existe).'
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

export default router;
