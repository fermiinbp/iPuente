// Acceso a la colección payments (id = id de la sesión de Checkout: un pago por sesión, así el webhook es idempotente).
// Campos: bookingId, userId, amount (euros), amountCents, currency (EUR), provider (STRIPE), providerPaymentId (payment_intent),
// providerSessionId, status (PENDING | SUCCEEDED | FAILED | REFUNDED), refundPending (reembolso por hacer), refundReason,
// refundId, refundedAt, createdAt, updatedAt. Nunca guarda datos de tarjeta.
import { createModel } from './baseModel.js';

const base = createModel('payments');

export const { findById, create, upsert, update, remove } = base;

// Pagos de una reserva.
export function listByBooking(bookingId, options) {
  return base.listBy('bookingId', bookingId, options);
}
