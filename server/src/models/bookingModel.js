// Acceso a la colección bookings. Campos: userId, companyId, roomId, startDate, endDate, price, pricePeriod, totalAmount,
// status (PENDING_PAYMENT | CONFIRMED | CANCELLED | EXPIRED | COMPLETED), paymentId, createdAt, updatedAt.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('bookings');

export const { findById, create, upsert, update, remove } = base;

export function listByUser(userId) {
  return base.listBy('userId', userId, { orderBy: 'startDate', direction: 'desc' });
}

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId, { orderBy: 'startDate', direction: 'desc' });
}

// Reservas de una sala que empiezan en [from, to). Si no se pasan fechas, todas.
// Acepta { tx } para leer dentro de una transacción.
export function listByRoom(roomId, { from, to, tx } = {}) {
  let query = base.collection().where('roomId', '==', roomId);
  if (from) query = query.where('startDate', '>=', from);
  if (to) query = query.where('startDate', '<', to);
  return runQuery(query, { orderBy: 'startDate', tx });
}

// Reservas de una empresa que empiezan en [from, to), las más recientes primero (índice
// companyId + startDate DESC). Máximo `limit` resultados.
export function listByCompanyInRange(companyId, { from, to, limit = 500 }) {
  const query = base
    .collection()
    .where('companyId', '==', companyId)
    .where('startDate', '>=', from)
    .where('startDate', '<', to);
  return runQuery(query, { orderBy: 'startDate', direction: 'desc', limit });
}
