// Rutas del perfil del usuario autenticado. Ninguna permite cambiar el propio rol.
import { Router } from 'express';

import { getMe, updateMe } from '../controllers/usersController.js';
import { auth } from '../middlewares/auth.js';
import { profileEditLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as userValidator from '../validators/userValidator.js';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Perfil:
 *       type: object
 *       required: [uid, email, role, companyId, nombre, apellidos, telefono]
 *       properties:
 *         uid:
 *           type: string
 *           example: 'Xy12AbC34dEf'
 *         email:
 *           type: string
 *           nullable: true
 *           example: 'cliente@ejemplo.com'
 *         role:
 *           type: string
 *           enum: [CLIENT, COMPANY, ADMIN]
 *           example: CLIENT
 *         companyId:
 *           type: string
 *           nullable: true
 *           example: null
 *         nombre:
 *           type: string
 *           nullable: true
 *           example: 'Ana'
 *         apellidos:
 *           type: string
 *           nullable: true
 *           example: 'López'
 *         telefono:
 *           type: string
 *           nullable: true
 *           example: '612345678'
 *         aviso:
 *           type: string
 *           description: Solo en PATCH, si no se pudo sincronizar el nombre de la cuenta.
 */

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Cliente]
 *     summary: Devuelve el usuario autenticado
 *     description: 'Lee el ID token de Firebase y devuelve su `uid`, `email`, `role` y `companyId`, más `nombre`, `apellidos` y `telefono` de su ficha (`null` si no existen). Sin rol en el token, el usuario es `CLIENT`.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Perfil'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/users/me', auth, asyncHandler(getMe));

/**
 * @openapi
 * /users/me:
 *   patch:
 *     tags: [Cliente]
 *     summary: Edita el perfil propio
 *     description: 'Cambia `nombre`, `apellidos` y `telefono` (al menos uno). `apellidos` y `telefono` admiten `null` para borrarlos. Cualquier otra clave (`role`, `email`, `companyId`...) se ignora. Crea la ficha si no existía y sincroniza el nombre de la cuenta; si eso falla, responde 200 con `aviso`.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: 'Ana'
 *               apellidos:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 example: 'López'
 *               telefono:
 *                 type: string
 *                 nullable: true
 *                 example: '612345678'
 *     responses:
 *       200:
 *         description: Perfil actualizado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Perfil'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.patch(
  '/users/me',
  auth,
  profileEditLimiter,
  userValidator.updateMe,
  validate,
  asyncHandler(updateMe),
);

export default router;
