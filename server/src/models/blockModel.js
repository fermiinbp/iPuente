// Acceso a la colección blocks: horas que la empresa bloquea en una sala (mantenimiento, uso propio).
// Campos: companyId, roomId, startDate, endDate, reason, createdAt, updatedAt. No son reservas de clientes.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('blocks');

export const { findById, create, upsert, update, remove } = base;

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId, { orderBy: 'startDate' });
}

// Bloqueos de una sala que empiezan en [from, to). Si no se pasan fechas, todos.
export function listByRoom(roomId, { from, to } = {}) {
  let query = base.collection().where('roomId', '==', roomId);
  if (from) query = query.where('startDate', '>=', from);
  if (to) query = query.where('startDate', '<', to);
  return runQuery(query, { orderBy: 'startDate' });
}
