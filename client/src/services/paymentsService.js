// Pagos del cliente: pide a la API la URL de Stripe Checkout de una reserva pendiente de pago.
// El importe lo decide la API (el de la reserva); aquí solo se envía qué reserva se paga.
// Todavía no hay endpoint de pago en la API: hasta entonces la llamada falla y la pantalla lo avisa.
import { post } from './apiClient.js';

// Devuelve { url }: la página de Stripe a la que hay que llevar a la persona.
export function createCheckout(bookingId) {
  return post('/payments/checkout', { bookingId });
}
