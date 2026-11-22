// Rutas de pago del cliente: crea la sesión de Stripe Checkout de una reserva pendiente de pago. El webhook va en webhook.routes.js.
import { Router } from 'express';

import { ROLES } from '../config/roles.js';
import { createCheckout } from '../controllers/paymentsController.js';
import { auth } from '../middlewares/auth.js';
import { checkoutLimiter } from '../middlewares/rateLimit.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as paymentValidator from '../validators/paymentValidator.js';

const router = Router();

/**
 * @openapi
 * /payments/checkout/{bookingId}:
 *   post:
 *     tags: [Pagos]
 *     summary: Crea la sesión de pago de una reserva
 *     description: 'Solo rol CLIENT. Crea una sesión de Stripe Checkout (modo prueba) para una reserva propia en estado PENDING_PAYMENT; el importe lo calcula el servidor. Si ya hay una sesión abierta, devuelve la misma. Una reserva ajena o inexistente responde 404; sin Stripe configurado, 503 PAYMENTS_UNAVAILABLE.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sesión de pago.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Dirección de Stripe Checkout a la que enviar al cliente.
 *                 sesionId:
 *                   type: string
 *                 expiraEn:
 *                   type: string
 *                   format: date-time
 *             example:
 *               url: https://checkout.stripe.com/c/pay/cs_test_a1b2c3
 *               sesionId: cs_test_a1b2c3
 *               expiraEn: '2026-12-15T10:31:00.000Z'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: La reserva no está pendiente de pago (BOOKING_NOT_PENDING), ha caducado (BOOKING_EXPIRED), su pago ya se está procesando (PAYMENT_IN_PROGRESS) o su importe no se puede cobrar (INVALID_AMOUNT).
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 code: BOOKING_NOT_PENDING
 *                 message: La reserva no está pendiente de pago
 *       429:
 *         description: Demasiados intentos de pago (RATE_LIMITED).
 *       502:
 *         description: No se ha podido conectar con Stripe (PAYMENTS_ERROR).
 *       503:
 *         description: Los pagos no están configurados (PAYMENTS_UNAVAILABLE).
 */
router.post(
  '/payments/checkout/:bookingId',
  auth,
  requireRole(ROLES.CLIENT),
  checkoutLimiter,
  ...paymentValidator.checkout,
  validate,
  asyncHandler(createCheckout),
);

export default router;
