// Rutas del panel de empresa: alta, edificios, plantas, mapas (guardar, publicar), salas, reservas y bloqueos. Cada empresa solo accede a lo suyo.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/companyController.js';
import { auth, authStrict } from '../middlewares/auth.js';
import { companyEditLimiter } from '../middlewares/rateLimit.js';
import { requireApprovedCompany } from '../middlewares/requireApprovedCompany.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as authValidator from '../validators/authValidator.js';
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
 *                 nombreEmpresa:
 *                   type: string
 *                   example: 'Oficinas Sevilla SL'
 *                 cif:
 *                   type: string
 *                   example: 'B12345674'
 *                 contacto:
 *                   type: string
 *                   nullable: true
 *                 telefono:
 *                   type: string
 *                   nullable: true
 *                 emailContacto:
 *                   type: string
 *                   nullable: true
 *                 ciudad:
 *                   type: string
 *                   nullable: true
 *                 estado:
 *                   type: string
 *                   enum: [pendiente, aprobada, rechazada, suspendida]
 *                 motivo:
 *                   type: string
 *                   nullable: true
 *                   description: Motivo de rechazo o suspensión vigente.
 *                 fechaSolicitud:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   description: Fecha del alta o, si se reenvió tras un rechazo, del reenvío.
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
 * /companies/me:
 *   patch:
 *     tags: [Empresa]
 *     summary: Edita los datos de la solicitud de la empresa propia
 *     description: 'Todos los campos son opcionales (al menos uno). Con la empresa pendiente o rechazada se puede editar todo; si estaba rechazada vuelve a `pendiente`. Con la empresa aprobada o suspendida solo `contacto`, `telefono` y `emailContacto` (otro campo da 400 `FIELD_NOT_EDITABLE`). Cambiar el CIF reserva el nuevo y libera el viejo (409 `COMPANY_EXISTS` si ya existe). No exige empresa aprobada. Límite: 20 peticiones por hora por usuario (429 `RATE_LIMITED`). Responde con la misma forma que `GET /companies/me`.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombreEmpresa:
 *                 type: string
 *               cif:
 *                 type: string
 *                 example: 'B12345674'
 *               contacto:
 *                 type: string
 *               telefono:
 *                 type: string
 *                 example: '954123456'
 *               emailContacto:
 *                 type: string
 *                 format: email
 *               ciudad:
 *                 type: string
 *     responses:
 *       200:
 *         description: Empresa actualizada (misma forma que `GET /companies/me`).
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Ya existe una empresa con ese CIF (`COMPANY_EXISTS`).
 */
router.patch(
  '/companies/me',
  authStrict,
  requireRole(ROLES.COMPANY),
  companyEditLimiter,
  authValidator.updateMe,
  validate,
  asyncHandler(ctrl.updateMyCompany),
);

/**
 * @openapi
 * /company/summary:
 *   get:
 *     tags: [Empresa]
 *     summary: Resumen del panel de la empresa
 *     description: 'Cifras, próximas reservas y tareas pendientes de la empresa. `primerAcceso` es true si no tiene edificios (bienvenida). `cifras`: edificios, salas publicadas (activas, con precio y reservables) y reservas e ingresos del mes natural (solo CONFIRMED y COMPLETED, por fecha de inicio; zona Europe/Madrid). `proximasReservas`: las 5 próximas reservas vivas (CONFIRMED o PENDING_PAYMENT) a partir de ahora, con sala y cliente (nombre y email). `tareas`: plantas sin publicar (`sinMapa` indica si no tienen salas dibujadas), salas sin precio y salas sin fotos, con sus ids para «Resolver»; cada lista llega recortada a 50 y `totales` da el recuento real. Lo eliminado no cuenta. Se leen como mucho 1000 edificios, plantas y salas; si hay más, la respuesta lleva `truncado: true`. Respuesta con `Cache-Control: private, max-age=30`. No admite parámetros. Solo para empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen de la empresa.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 primerAcceso:
 *                   type: boolean
 *                 truncado:
 *                   type: boolean
 *                   description: Solo aparece (true) si la empresa tiene más de 1000 edificios, plantas o salas.
 *                 mes:
 *                   type: string
 *                   example: '2026-11'
 *                 cifras:
 *                   type: object
 *                   properties:
 *                     edificios:
 *                       type: integer
 *                     salasPublicadas:
 *                       type: integer
 *                     reservasMes:
 *                       type: integer
 *                     ingresosMes:
 *                       type: number
 *                       example: 150.5
 *                 proximasReservas:
 *                   type: array
 *                   maxItems: 5
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       codigo:
 *                         type: string
 *                         example: 'IP-1000'
 *                       fecha:
 *                         type: string
 *                         example: '2026-11-25'
 *                       inicio:
 *                         type: integer
 *                       fin:
 *                         type: integer
 *                       importe:
 *                         type: number
 *                       estado:
 *                         type: string
 *                         enum: [CONFIRMED, PENDING_PAYMENT]
 *                       sala:
 *                         type: object
 *                         properties:
 *                           nombre:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                       cliente:
 *                         type: object
 *                         properties:
 *                           nombre:
 *                             type: string
 *                           email:
 *                             type: string
 *                 tareas:
 *                   type: object
 *                   properties:
 *                     plantasSinPublicar:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nombre:
 *                             type: string
 *                           numero:
 *                             type: integer
 *                           buildingId:
 *                             type: string
 *                           edificio:
 *                             type: string
 *                           sinMapa:
 *                             type: boolean
 *                     salasSinPrecio:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nombre:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           floorId:
 *                             type: string
 *                           buildingId:
 *                             type: string
 *                     salasSinFotos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nombre:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           floorId:
 *                             type: string
 *                           buildingId:
 *                             type: string
 *                     totales:
 *                       type: object
 *                       properties:
 *                         plantasSinPublicar:
 *                           type: integer
 *                         salasSinPrecio:
 *                           type: integer
 *                         salasSinFotos:
 *                           type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/company/summary',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.summary,
  validate,
  asyncHandler(ctrl.getSummary),
);

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
 *     description: 'Se crea en borrador (`publicado: false`). Obligatorios `nombre`, `direccion` y `ciudad`; opcionales `descripcion` y `fotos` (URLs de imágenes de tu carpeta `companies/{companyId}/` en Firebase Storage). Solo para empresas aprobadas.'
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
 *     description: 'Todos los campos son opcionales, pero hay que enviar al menos uno de `nombre`, `direccion`, `ciudad`, `descripcion` o `fotos`. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (un recurso ajeno o inexistente responde el mismo 404).'
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
 *     description: 'Body `{ numero, nombre }` (`numero` entero de -10 a 200; 0 o negativo para sótanos). Se crea en borrador sin salas. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (un recurso ajeno o inexistente responde el mismo 404).'
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
 *     description: 'Body con `numero` y/o `nombre` (al menos uno). Solo para empresas aprobadas; cada empresa solo accede a lo suyo (un recurso ajeno o inexistente responde el mismo 404).'
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
 *     description: 'Campos opcionales (al menos uno): `nombre`, `capacidad`, `m2`, `precioHora`, `gratis`, `equipamiento`, `reservable`, `fotos`. `gratis: true` (sala gratis, `isFree`) no puede ir con `precioHora` (400 VALIDATION_ERROR en `gratis`) y deja `precioHora` en `null`; enviar `precioHora` la desmarca como gratis; `gratis: false` sin precio la deja `sin_precio`. Devuelve `{ id, floorId, buildingId, codigo, nombre, capacidad, m2, precioHora, gratis, equipamiento, reservable, fotos }`. Solo para empresas aprobadas; cada empresa solo accede a lo suyo (un recurso ajeno o inexistente responde el mismo 404). Una sala que ya no está en el mapa da `ROOM_INACTIVE` (400).'
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
 *     description: 'Requiere al menos una planta publicada (`NO_PUBLISHED_FLOORS`). Es idempotente. Solo para empresas aprobadas; ajeno o inexistente 404.'
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
 *     description: 'Es idempotente. Si hay reservas futuras (CONFIRMED o PENDING_PAYMENT) en sus salas, no se bloquea: se devuelven `reservasFuturas` y un `aviso`. Solo para empresas aprobadas; ajeno o inexistente 404.'
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
 *     description: 'Solo salas activas, ordenadas por edificio, planta y código. Cada una incluye `estado`: `sin_precio` (sin precio mayor que 0), `publicada` (con precio y reservable) u `oculta`. Si se pasa `buildingId` o `floorId` deben ser propios (si son de otra empresa o no existen, 404). Solo para empresas aprobadas.'
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
 *         description: 'Lista de salas con `id, floorId, buildingId, codigo, nombre, capacidad, m2, precioHora, gratis, equipamiento, reservable, fotos, estado`.'
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
 *     description: 'Body `{ visible }` (booleano). Mostrar una sala sin precio mayor que 0 y sin `gratis` da `ROOM_WITHOUT_PRICE` (con precio o gratis se puede mostrar); una sala que ya no está en el mapa da `ROOM_INACTIVE`. Con `visible: false` y reservas futuras (CONFIRMED o PENDING_PAYMENT) se devuelven `reservasFuturas` y un `aviso`; no se bloquea. Solo para empresas aprobadas; ajena o inexistente 404.'
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

/**
 * @openapi
 * /company/buildings/{id}:
 *   delete:
 *     tags: [Empresa]
 *     summary: Elimina un edificio propio con sus plantas y salas
 *     description: 'Elimina el edificio con todas sus plantas y salas. Si alguna sala afectada tiene reservas futuras (CONFIRMED o PENDING_PAYMENT) responde 409 `HAS_FUTURE_BOOKINGS` con `details.reservasFuturas` y no cancela nada. Sin reservas futuras: lo que nunca tuvo reservas se borra del todo (también sus bloqueos y su occupancy) y lo que tiene historial de reservas se elimina de forma lógica (`borradoLogico: true`): deja de verse en el panel, en la API pública y en el mapa, pero sus reservas pasadas siguen mostrando su sala, planta y edificio. No toca Storage. Solo para empresas aprobadas; ajeno, inexistente o ya eliminado 404.'
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
 *         description: 'Eliminado: `{ id, eliminado: true, borradoLogico, plantasEliminadas, salasEliminadas, salasDesactivadas, bloqueosEliminados, aviso? }`.'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: {type: string}
 *                 eliminado: {type: boolean, example: true}
 *                 borradoLogico: {type: boolean}
 *                 plantasEliminadas: {type: integer}
 *                 salasEliminadas: {type: integer}
 *                 salasDesactivadas: {type: integer}
 *                 bloqueosEliminados: {type: integer}
 *                 aviso: {type: string}
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 'Hay reservas futuras (`HAS_FUTURE_BOOKINGS`, con `details.reservasFuturas`).'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code: {type: string, example: HAS_FUTURE_BOOKINGS}
 *                     message: {type: string}
 *                     details:
 *                       type: object
 *                       properties:
 *                         reservasFuturas: {type: integer}
 */
router.delete(
  '/company/buildings/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.deleteResource,
  validate,
  asyncHandler(ctrl.deleteBuilding),
);

/**
 * @openapi
 * /company/floors/{id}:
 *   delete:
 *     tags: [Empresa]
 *     summary: Elimina una planta propio con sus salas
 *     description: 'Elimina la planta con todas sus salas. Si alguna sala afectada tiene reservas futuras (CONFIRMED o PENDING_PAYMENT) responde 409 `HAS_FUTURE_BOOKINGS` con `details.reservasFuturas` y no cancela nada. Sin reservas futuras: lo que nunca tuvo reservas se borra del todo (también sus bloqueos y su occupancy) y lo que tiene historial de reservas se elimina de forma lógica (`borradoLogico: true`): deja de verse en el panel, en la API pública y en el mapa, pero sus reservas pasadas siguen mostrando su sala, planta y edificio. No toca Storage. Solo para empresas aprobadas; ajeno, inexistente o ya eliminado 404.'
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
 *         description: 'Eliminado: `{ id, eliminado: true, borradoLogico, plantasEliminadas, salasEliminadas, salasDesactivadas, bloqueosEliminados, aviso? }`.'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: {type: string}
 *                 eliminado: {type: boolean, example: true}
 *                 borradoLogico: {type: boolean}
 *                 plantasEliminadas: {type: integer}
 *                 salasEliminadas: {type: integer}
 *                 salasDesactivadas: {type: integer}
 *                 bloqueosEliminados: {type: integer}
 *                 aviso: {type: string}
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 'Hay reservas futuras (`HAS_FUTURE_BOOKINGS`, con `details.reservasFuturas`).'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code: {type: string, example: HAS_FUTURE_BOOKINGS}
 *                     message: {type: string}
 *                     details:
 *                       type: object
 *                       properties:
 *                         reservasFuturas: {type: integer}
 */
router.delete(
  '/company/floors/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.deleteResource,
  validate,
  asyncHandler(ctrl.deleteFloor),
);

/**
 * @openapi
 * /company/rooms/{id}:
 *   delete:
 *     tags: [Empresa]
 *     summary: Elimina una sala propio
 *     description: 'Elimina la sala y la quita del mapa de su planta. Si alguna sala afectada tiene reservas futuras (CONFIRMED o PENDING_PAYMENT) responde 409 `HAS_FUTURE_BOOKINGS` con `details.reservasFuturas` y no cancela nada. Sin reservas futuras: lo que nunca tuvo reservas se borra del todo (también sus bloqueos y su occupancy) y lo que tiene historial de reservas se elimina de forma lógica (`borradoLogico: true`): deja de verse en el panel, en la API pública y en el mapa, pero sus reservas pasadas siguen mostrando su sala, planta y edificio. No toca Storage. Solo para empresas aprobadas; ajeno, inexistente o ya eliminado 404.'
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
 *         description: 'Eliminado: `{ id, eliminado: true, borradoLogico, plantasEliminadas, salasEliminadas, salasDesactivadas, bloqueosEliminados, aviso? }`.'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: {type: string}
 *                 eliminado: {type: boolean, example: true}
 *                 borradoLogico: {type: boolean}
 *                 plantasEliminadas: {type: integer}
 *                 salasEliminadas: {type: integer}
 *                 salasDesactivadas: {type: integer}
 *                 bloqueosEliminados: {type: integer}
 *                 aviso: {type: string}
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: 'Hay reservas futuras (`HAS_FUTURE_BOOKINGS`, con `details.reservasFuturas`).'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code: {type: string, example: HAS_FUTURE_BOOKINGS}
 *                     message: {type: string}
 *                     details:
 *                       type: object
 *                       properties:
 *                         reservasFuturas: {type: integer}
 */
router.delete(
  '/company/rooms/:id',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...companyValidator.deleteResource,
  validate,
  asyncHandler(ctrl.deleteRoom),
);

export default router;
