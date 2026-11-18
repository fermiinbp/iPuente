// Rutas del perfil del usuario autenticado. Ninguna permite cambiar el propio rol.
import { Router } from 'express';

import { getMe } from '../controllers/usersController.js';
import { auth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Cliente]
 *     summary: Devuelve el usuario autenticado
 *     description: 'Lee el ID token de Firebase y devuelve su `uid`, `email`, `role` y `companyId`. Sin rol en el token, el usuario es `CLIENT`.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [uid, email, role, companyId]
 *               properties:
 *                 uid:
 *                   type: string
 *                   example: 'Xy12AbC34dEf'
 *                 email:
 *                   type: string
 *                   nullable: true
 *                   example: 'cliente@ejemplo.com'
 *                 role:
 *                   type: string
 *                   enum: [CLIENT, COMPANY, ADMIN]
 *                   example: CLIENT
 *                 companyId:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/users/me', auth, getMe);

export default router;
