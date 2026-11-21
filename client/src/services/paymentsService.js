// Pagos del cliente: pide a la API la URL de Stripe Checkout de una reserva pendiente de pago.
// El importe lo decide la API (el de la reserva); aquí solo se envía qué reserva se paga.
import { post } from './apiClient.js';

// Devuelve { url, sesionId, expiraEn }: la página de Stripe a la que hay que llevar a la persona.
// Errores: 404 (reserva ajena), 409 BOOKING_NOT_PENDING, BOOKING_EXPIRED, BOOKING_STARTED, PAYMENT_IN_PROGRESS,
// INVALID_AMOUNT; 502 PAYMENTS_ERROR; 503 PAYMENTS_UNAVAILABLE.
export function createCheckout(bookingId) {
  return post(`/payments/checkout/${encodeURIComponent(bookingId)}`);
}
