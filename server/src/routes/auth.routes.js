// Rutas públicas de registro de clientes y empresas. El rol y el estado los fija el servidor.
import { Router } from 'express';

import { registerClient, registerCompany } from '../controllers/authController.js';
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
 */
router.post(
  '/auth/register/client',
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
 *             required: [email, password, nombre, nombreEmpresa, cif, contacto, telefono]
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
 *         description: Ya existe una cuenta con ese email (`EMAIL_EXISTS`) o una empresa con ese CIF (`COMPANY_EXISTS`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/auth/register/company',
  authValidator.registerCompany,
  validate,
  asyncHandler(registerCompany),
);

export default router;
