// Ruta del webhook de Stripe: recibe el body sin parsear (Buffer) para verificar la firma y confirma la reserva pagada. Se monta en app.js antes del límite general y de express.json.
import express, { Router } from 'express';

import { handleWebhook } from '../controllers/paymentsController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/**
 * @openapi
 * /payments/webhook:
 *   post:
 *     tags: [Pagos]
 *     summary: Webhook de Stripe
 *     description: 'Lo llama Stripe, no la web. El cuerpo se verifica con la cabecera Stripe-Signature y el secreto del webhook. Gestiona checkout.session.completed (confirma la reserva y guarda el pago, o lo reembolsa si ya no se puede aceptar) y checkout.session.expired (expira la reserva). El resto de eventos se ignoran con 200. Si algo falla por dentro responde 500 para que Stripe reintente.'
 *     parameters:
 *       - in: header
 *         name: Stripe-Signature
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Evento recibido (procesado o ignorado).
 *         content:
 *           application/json:
 *             example:
 *               recibido: true
 *       400:
 *         description: Firma no válida (INVALID_SIGNATURE).
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 code: INVALID_SIGNATURE
 *                 message: Firma del webhook no válida
 *       500:
 *         description: Error interno al procesar el evento; Stripe lo reintentará.
 *       503:
 *         description: Webhook sin configurar (PAYMENTS_UNAVAILABLE).
 */
router.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(handleWebhook),
);

export default router;
