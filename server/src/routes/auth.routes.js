// Rutas de registro de clientes y empresas (públicas) y alta con Google (con token). El rol y el estado los fija el servidor.
import { Router } from 'express';

import { googleSignIn, registerClient, registerCompany } from '../controllers/authController.js';
import { authStrict } from '../middlewares/auth.js';
import { googleAuthLimiter, registerLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as authValidator from '../validators/authValidator.js';

const router = Router();

/**
 * @openapi
 * /auth/register/client:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un cliente
 *     description: Crea el usuario en Firebase Auth con rol `CLIENT` y su ficha en `users`. Cualquier `role` del body se ignora.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nombre]
 *             properties:
 *               email:
 *                 type: string
 *                 example: 'cliente@ejemplo.com'
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: 'contraseña-segura'
 *               nombre:
 *                 type: string
 *                 example: 'Ana López'
 *     responses:
 *       201:
 *         description: Cliente creado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [uid]
 *               properties:
 *                 uid:
 *                   type: string
 *                   example: 'Xy12AbC34dEf'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Ya existe una cuenta con ese email (`EMAIL_EXISTS`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post(
  '/auth/register/client',
  registerLimiter,
  authValidator.registerClient,
  validate,
  asyncHandler(registerClient),
);

/**
 * @openapi
 * /auth/register/company:
 *   post:
 *     tags: [Auth]
 *     summary: Registra una empresa
 *     description: Crea el usuario con rol `COMPANY` y una empresa en estado `pendiente` hasta que un admin la apruebe. `role`, `status`, `verified` y `companyId` del body se ignoran.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nombre, nombreEmpresa, cif, contacto, telefono, emailContacto, ciudad, aceptaCondiciones]
 *             properties:
 *               email:
 *                 type: string
 *                 example: 'empresa@ejemplo.com'
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: 'contraseña-segura'
 *               nombre:
 *                 type: string
 *                 example: 'Luis Pérez'
 *               nombreEmpresa:
 *                 type: string
 *                 example: 'Oficinas Sevilla SL'
 *               cif:
 *                 type: string
 *                 description: CIF español con dígito de control válido.
 *                 example: 'B12345674'
 *               contacto:
 *                 type: string
 *                 example: 'Marta Ruiz'
 *               telefono:
 *                 type: string
 *                 description: 9 dígitos, empieza por 6, 7, 8 o 9.
 *                 example: '954123456'
 *               emailContacto:
 *                 type: string
 *                 format: email
 *                 example: 'contacto@ejemplo.com'
 *               ciudad:
 *                 type: string
 *                 description: De 2 a 100 caracteres.
 *                 example: 'Sevilla'
 *               aceptaCondiciones:
 *                 type: boolean
 *                 description: Debe ser exactamente `true`.
 *     responses:
 *       201:
 *         description: Empresa creada, pendiente de aprobación.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [uid, companyId, estado]
 *               properties:
 *                 uid:
 *                   type: string
 *                 companyId:
 *                   type: string
 *                 estado:
 *                   type: string
 *                   example: pendiente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Ya existe una cuenta con ese email (`EMAIL_EXISTS`), el email es de un cliente (`EMAIL_IS_CLIENT`) o ya hay una empresa con ese CIF (`COMPANY_EXISTS`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post(
  '/auth/register/company',
  registerLimiter,
  authValidator.registerCompany,
  validate,
  asyncHandler(registerCompany),
);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Da de alta a quien entra con Google
 *     description: Crea su ficha en `users` y le asigna el rol `CLIENT` solo si aún no tiene rol. Si ya lo tiene no cambia nada (idempotente) y nunca se puede elegir rol. Exige un token de Google con el correo verificado y un body vacío. Si `refrescarToken` es `true`, hay que renovar el token para leer el rol.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: La cuenta ya estaba dada de alta (o solo se ha reparado el rol).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [uid, rol, creado, refrescarToken]
 *               properties:
 *                 uid:
 *                   type: string
 *                 rol:
 *                   type: string
 *                   example: CLIENT
 *                 creado:
 *                   type: boolean
 *                 refrescarToken:
 *                   type: boolean
 *       201:
 *         description: Ficha creada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [uid, rol, creado, refrescarToken]
 *               properties:
 *                 uid:
 *                   type: string
 *                 rol:
 *                   type: string
 *                   example: CLIENT
 *                 creado:
 *                   type: boolean
 *                   example: true
 *                 refrescarToken:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: El acceso no es con Google (`GOOGLE_REQUIRED`) o el correo no está verificado (`EMAIL_NOT_VERIFIED`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: La cuenta tiene un estado inconsistente (`ACCOUNT_INCONSISTENT`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post(
  '/auth/google',
  authStrict,
  googleAuthLimiter,
  authValidator.googleSignIn,
  validate,
  asyncHandler(googleSignIn),
);

export default router;
