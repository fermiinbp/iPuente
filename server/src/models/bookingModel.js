// Acceso a la colección bookings. Campos: code (IP-1000...), userId, companyId, roomId, startDate, endDate, price, pricePeriod,
// totalAmount, status (PENDING_PAYMENT | CONFIRMED | CANCELLED | EXPIRED | COMPLETED), paymentId, cancelledAt,
// cancelledBy (CLIENT | COMPANY), cancelReason, createdAt, updatedAt.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('bookings');

export const { findById, create, upsert, update, remove, countWhere } = base;

export function listByUser(userId) {
  return base.listBy('userId', userId, { orderBy: 'startDate', direction: 'desc' });
}

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId, { orderBy: 'startDate', direction: 'desc' });
}

// Reservas de una sala que empiezan en [from, to). Si no se pasan fechas, todas.
// Acepta { tx } para leer dentro de una transacción.
// Con { limit } devuelve como mucho ese número de reservas (las más próximas primero).
export function listByRoom(roomId, { from, to, tx, limit } = {}) {
  let query = base.collection().where('roomId', '==', roomId);
  if (from) query = query.where('startDate', '>=', from);
  if (to) query = query.where('startDate', '<', to);
  return runQuery(query, { orderBy: 'startDate', tx, limit });
}

// ¿La sala tiene alguna reserva, en cualquier estado? Lee como mucho un documento.
export async function hasAnyForRoom(roomId, { tx } = {}) {
  const query = base.collection().where('roomId', '==', roomId);
  return (await runQuery(query, { limit: 1, tx })).length > 0;
}

// Reservas de varias salas que empiezan en [from, to), en lotes de 30 ids (límite de `in`).
// Una consulta por lote en lugar de una por sala.
// Con { tx } lee dentro de una transacción.
export async function listByRooms(roomIds, { from, to, tx } = {}) {
  const chunks = [];
  for (let i = 0; i < roomIds.length; i += 30) chunks.push(roomIds.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((ids) => {
      let query = base.collection().where('roomId', 'in', ids);
      if (from) query = query.where('startDate', '>=', from);
      if (to) query = query.where('startDate', '<', to);
      return runQuery(query, { orderBy: 'startDate', tx });
    }),
  );
  return results.flat();
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

// Reservas de todas las empresas que empiezan en [from, to), las más recientes primero, con filtros
// opcionales por empresa y estado (índices status + startDate y companyId + status + startDate).
// Máximo `limit` resultados.
export function listInRange({ from, to, companyId, status, limit = 500 }) {
  let query = base.collection();
  if (companyId) query = query.where('companyId', '==', companyId);
  if (status) query = query.where('status', '==', status);
  query = query.where('startDate', '>=', from).where('startDate', '<', to);
  return runQuery(query, { orderBy: 'startDate', direction: 'desc', limit });
}

// Cuenta las reservas de una empresa con alguno de los estados que empiezan en [from, to) y suma su
// totalAmount, con una agregación de Firestore (no lee los documentos ni tiene tope).
// Índice companyId + status + startDate. Devuelve { count, total }.
export function summarizeByCompany(companyId, { statuses, from, to }) {
  return base.aggregateWhere(
    [
      ['companyId', '==', companyId],
      ['status', 'in', statuses],
      ['startDate', '>=', from],
      ['startDate', '<', to],
    ],
    'totalAmount',
  );
}

// Próximas reservas de una empresa con alguno de los estados dados que empiezan desde `from`, la más
// cercana primero y como mucho `limit` (índice companyId + status + startDate ASC).
export function listUpcomingByCompany(companyId, { statuses, from, limit }) {
  const query = base
    .collection()
    .where('companyId', '==', companyId)
    .where('status', 'in', statuses)
    .where('startDate', '>=', from);
  return runQuery(query, { orderBy: 'startDate', direction: 'asc', limit });
}
