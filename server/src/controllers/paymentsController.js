// Controlador de pagos: checkout de Stripe y webhook. Lee req, llama al service y responde; nunca habla con Firestore.
import * as paymentsService from '../services/paymentsService.js';

// Crea (o reutiliza) la sesión de Stripe Checkout de una reserva propia pendiente de pago.
export async function createCheckout(req, res) {
  res.json(await paymentsService.createCheckout(req.user.uid, req.params.bookingId));
}

// Webhook de Stripe: el body llega sin parsear (Buffer) para poder verificar la firma.
export async function handleWebhook(req, res) {
  const event = paymentsService.constructEvent(req.body, req.get('stripe-signature'));
  await paymentsService.handleEvent(event);
  res.json({ recibido: true });
}
