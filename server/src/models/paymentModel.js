// Acceso a la colección payments (id = id de la sesión de Checkout: un pago por sesión, así el webhook es idempotente).
// Campos: bookingId, userId, amount (euros), amountCents, currency (EUR), provider (STRIPE), providerPaymentId (payment_intent),
// providerSessionId, status (PENDING | SUCCEEDED | FAILED | REFUNDED), refundPending (reembolso por hacer), refundReason,
// refundId, refundedAt, refundAttempt (intento de reembolso: clave `refund:{id}:{n}`), createdAt, updatedAt. Nunca guarda datos de tarjeta.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('payments');

export const { findById, create, upsert, update, remove } = base;

// Pagos de una reserva.
export function listByBooking(bookingId, options) {
  return base.listBy('bookingId', bookingId, options);
}

// Cuenta y suma `sumField` de los pagos que cumplen los filtros con una agregación de Firestore
// (no lee los documentos). Devuelve { count, total }. Índices status (+ refundPending) + createdAt + amountCents.
export function aggregateWhere(filters, sumField) {
  return base.aggregateWhere(filters, sumField);
}

// Pagos, los más recientes primero, con filtro opcional por estado (índice status + createdAt DESC).
// Máximo `limit` resultados.
export function listAll({ status, limit = 500 } = {}) {
  let query = base.collection();
  if (status) query = query.where('status', '==', status);
  return runQuery(query, { orderBy: 'createdAt', direction: 'desc', limit });
}
