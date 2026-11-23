// Rutas de cobros de la empresa con Stripe Connect (/company/payouts): estado, alta, movimientos y panel de Stripe. Solo COMPANY aprobada.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import * as ctrl from '../controllers/payoutsController.js';
import { auth } from '../middlewares/auth.js';
import { payoutsLimiter, payoutsReadLimiter } from '../middlewares/rateLimit.js';
import { requireApprovedCompany } from '../middlewares/requireApprovedCompany.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as payoutsValidator from '../validators/payoutsValidator.js';

const router = Router();

/**
 * @openapi
 * /company/payouts:
 *   get:
 *     tags: [Empresa]
 *     summary: Estado de la cuenta de cobros de la empresa
 *     description: 'Consulta a Stripe el estado real de la cuenta conectada y lo guarda. `estado`: `none` (sin cuenta), `pending` (alta sin terminar), `active` (puede cobrar) o `restricted`. Si Stripe no responde, devuelve el último estado guardado con `desactualizado: true` y `aviso`. No devuelve el id de la cuenta. Solo empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de cobros.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conectada:
 *                   type: boolean
 *                 estado:
 *                   type: string
 *                   enum: [none, pending, active, restricted]
 *                 requisitosPendientes:
 *                   type: boolean
 *                 comprobadoEn:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 desactualizado:
 *                   type: boolean
 *                 aviso:
 *                   type: string
 *             example:
 *               conectada: true
 *               estado: pending
 *               requisitosPendientes: true
 *               comprobadoEn: '2026-12-15T10:00:00.000Z'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         description: Demasiadas consultas (RATE_LIMITED).
 */
router.get(
  '/company/payouts',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  payoutsReadLimiter,
  ...payoutsValidator.noParams,
  validate,
  asyncHandler(ctrl.getPayouts),
);

/**
 * @openapi
 * /company/payouts/onboarding:
 *   post:
 *     tags: [Empresa]
 *     summary: Conecta la empresa con Stripe para cobrar
 *     description: 'Crea la cuenta conectada de Stripe (una sola por empresa, aunque se pida varias veces o a la vez) y devuelve el enlace de alta. Si ya hay cuenta, la reutiliza y da un enlace para continuar. Las URL de vuelta son `{APP_URL}/company/settings?tab=cobros&stripe=retorno` y `&stripe=refrescar`. 409 `PAYOUTS_ALREADY_ACTIVE` si ya puede cobrar; 409 `PAYOUTS_BUSY` si otra petición la está creando; 429 `RATE_LIMITED`. Solo empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enlace de alta de Stripe.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *             example:
 *               url: https://connect.stripe.com/setup/e/acct_xxx/abc
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Ya está activa (PAYOUTS_ALREADY_ACTIVE) o se está creando (PAYOUTS_BUSY).
 *       429:
 *         description: Demasiadas peticiones (RATE_LIMITED).
 *       502:
 *         description: No se ha podido conectar con Stripe (PAYMENTS_ERROR).
 *       503:
 *         description: Los pagos no están configurados (PAYMENTS_UNAVAILABLE).
 */
router.post(
  '/company/payouts/onboarding',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  payoutsLimiter,
  ...payoutsValidator.noParams,
  validate,
  asyncHandler(ctrl.startOnboarding),
);

/**
 * @openapi
 * /company/payouts/movements:
 *   get:
 *     tags: [Empresa]
 *     summary: Movimientos (pagos) de la empresa
 *     description: 'Pagos de reservas de la empresa, los más recientes primero, 20 por página y hasta 500 leídos (`truncado` si se alcanza). Solo los de sus reservas. Sin datos del cliente ni ids de Stripe; `id` es opaco. Solo empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Página de movimientos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 movimientos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       codigoReserva:
 *                         type: string
 *                         nullable: true
 *                       sala:
 *                         type: string
 *                         nullable: true
 *                       fechaReserva:
 *                         type: string
 *                         nullable: true
 *                       importe:
 *                         type: number
 *                       moneda:
 *                         type: string
 *                       estado:
 *                         type: string
 *                         enum: [PENDING, SUCCEEDED, FAILED, REFUNDED]
 *                       reembolsoPendiente:
 *                         type: boolean
 *                       fecha:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 truncado:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/company/payouts/movements',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  ...payoutsValidator.movements,
  validate,
  asyncHandler(ctrl.listMovements),
);

/**
 * @openapi
 * /company/payouts/dashboard:
 *   post:
 *     tags: [Empresa]
 *     summary: Enlace al panel de Stripe de la empresa
 *     description: 'Devuelve un enlace de un solo uso al panel Express de Stripe de la empresa. 409 `PAYOUTS_REQUIRED` si aún no tiene cuenta; 429 `RATE_LIMITED`. Solo empresas aprobadas.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enlace al panel.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *             example:
 *               url: https://connect.stripe.com/express/abc
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Sin cuenta de cobros (PAYOUTS_REQUIRED).
 *       429:
 *         description: Demasiadas peticiones (RATE_LIMITED).
 *       502:
 *         description: No se ha podido conectar con Stripe (PAYMENTS_ERROR).
 *       503:
 *         description: Los pagos no están configurados (PAYMENTS_UNAVAILABLE).
 */
router.post(
  '/company/payouts/dashboard',
  auth,
  requireRole(ROLES.COMPANY),
  requireApprovedCompany,
  payoutsLimiter,
  ...payoutsValidator.noParams,
  validate,
  asyncHandler(ctrl.createDashboardLink),
);

export default router;
