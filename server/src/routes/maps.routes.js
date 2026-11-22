// Rutas de mapas de planta del panel de empresa: leer el mapa (GET /company/floors/:id), guardarlo, publicar la planta
// (POST /company/floors/:id/publish) y despublicarla (POST /company/floors/:id/unpublish).
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/mapsController.js';
import { auth } from '../middlewares/auth.js';
import { requireApprovedCompany } from '../middlewares/requireApprovedCompany.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as mapValidator from '../validators/mapValidator.js';

const router = Router();

/**
 * @openapi
 * /company/floors/{id}:
 *   get:
 *     tags: [Mapas]
 *     summary: Lee el mapa de una planta propia
 *     description: 'Devuelve el mapa guardado (borrador o publicado) para el editor. Las salas eliminadas no salen. Sin mapa: `salas` vacío y `ancho`, `alto`, `origen` y `mapImageUrl` a `null`. Solo para empresas aprobadas; una planta ajena, eliminada o inexistente responde el mismo 404.'
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
 *         description: 'Mapa: `{ id, buildingId, numero, nombre, publicado, ancho, alto, origen, salas, mapImageUrl }`.'
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
  '/company/floors/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...mapValidator.getFloor,
  validate,
  asyncHandler(ctrl.getFloor),
);

/**
 * @openapi
 * /company/floors/{id}/map:
 *   put:
 *     tags: [Mapas]
 *     summary: Guarda el mapa de una planta propia
 *     description: 'Sustituye el mapa de la planta y sincroniza sus salas: crea las nuevas (no reservables y sin precio), actualiza nombre, código y tipo de las existentes y marca como no reservables las que ya no están en el mapa. No cambia el estado de publicación; si la planta está publicada y deja de tener salas reservables con precio, la respuesta incluye `aviso`. Si hay reservas futuras (CONFIRMED o PENDING_PAYMENT) en sus salas, `reservasFuturas` las cuenta y `aviso` (texto único, se combinan los avisos) lo indica; siguen en pie y no se bloquea. Opcional `mapImageUrl`: URL de la imagen del plano en tu carpeta de Firebase Storage. Solo para empresas aprobadas.'
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
 *             required: [ancho, alto, origen, salas]
 *             properties:
 *               mapImageUrl:
 *                 type: string
 *               ancho:
 *                 type: number
 *                 example: 1000
 *               alto:
 *                 type: number
 *                 example: 600
 *               origen:
 *                 type: string
 *                 enum: [manual, ia]
 *               salas:
 *                 type: array
 *                 maxItems: 300
 *                 items:
 *                   type: object
 *                   required: [id, codigo, nombre, tipo, x, y, w, h]
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 'p0-s01'
 *                     codigo:
 *                       type: string
 *                       example: 'P0-S01'
 *                     nombre:
 *                       type: string
 *                       example: 'Sala Guadalquivir'
 *                     tipo:
 *                       type: string
 *                       enum: [sala, box, comun, cocina, pasillo]
 *                     x:
 *                       type: number
 *                     y:
 *                       type: number
 *                     w:
 *                       type: number
 *                     h:
 *                       type: number
 *     responses:
 *       200:
 *         description: 'Mapa guardado: `{ id, ancho, alto, origen, salas, publicado, mapImageUrl, salasCreadas, salasDesactivadas, aviso? }`.'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       # Además de VALIDATION_ERROR, puede ser TOO_MANY_CHANGES (más de 490 escrituras).
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 'Algún id de sala ya existe en otra planta (`ROOM_ID_TAKEN`).'
 */
router.put(
  '/company/floors/:id/map',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...mapValidator.saveMap,
  validate,
  asyncHandler(ctrl.saveMap),
);

/**
 * @openapi
 * /company/floors/{id}/publish:
 *   post:
 *     tags: [Mapas]
 *     summary: Publica una planta propia
 *     description: 'Requiere que la planta tenga mapa (`MAP_REQUIRED`) y al menos una sala del mapa reservable con precio (`NO_BOOKABLE_ROOMS`). Es idempotente. Solo para empresas aprobadas.'
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
 *         description: 'Planta publicada: `{ id, publicado: true }`.'
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
  '/company/floors/:id/publish',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...mapValidator.publishFloor,
  validate,
  asyncHandler(ctrl.publishFloor),
);

/**
 * @openapi
 * /company/floors/{id}/unpublish:
 *   post:
 *     tags: [Mapas]
 *     summary: Vuelve una planta propia a borrador
 *     description: 'Es idempotente. Si el edificio está publicado y era su última planta publicada, sigue publicado y la respuesta incluye `aviso`. Si hay reservas futuras (CONFIRMED o PENDING_PAYMENT) en sus salas, `reservasFuturas` las cuenta y `aviso` (texto único, se combinan los avisos) lo indica; siguen en pie y no se bloquea. Solo para empresas aprobadas; ajena o inexistente 404.'
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
 *         description: 'Planta en borrador con `id, buildingId, numero, nombre, publicado: false, reservasFuturas` y `aviso` opcional.'
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
  '/company/floors/:id/unpublish',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...mapValidator.unpublishFloor,
  validate,
  asyncHandler(ctrl.unpublishFloor),
);

export default router;
