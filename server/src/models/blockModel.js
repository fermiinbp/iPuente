// Acceso a la colección blocks: horas que la empresa bloquea en una sala (mantenimiento, uso propio).
// Campos: companyId, roomId, startDate, endDate, reason, createdAt, updatedAt. No son reservas de clientes.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('blocks');

export const { findById, create, upsert, update, remove } = base;

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId, { orderBy: 'startDate' });
}

// Bloqueos de una sala que empiezan en [from, to). Si no se pasan fechas, todos.
// Acepta { tx } para leer dentro de una transacción.
export function listByRoom(roomId, { from, to, tx } = {}) {
  let query = base.collection().where('roomId', '==', roomId);
  if (from) query = query.where('startDate', '>=', from);
  if (to) query = query.where('startDate', '<', to);
  return runQuery(query, { orderBy: 'startDate', tx });
}

// Bloqueos de varias salas que empiezan en [from, to), en lotes de 30 ids (límite de `in`).
// Una consulta por lote en lugar de una por sala.
export async function listByRooms(roomIds, { from, to } = {}) {
  const chunks = [];
  for (let i = 0; i < roomIds.length; i += 30) chunks.push(roomIds.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((ids) => {
      let query = base.collection().where('roomId', 'in', ids);
      if (from) query = query.where('startDate', '>=', from);
      if (to) query = query.where('startDate', '<', to);
      return runQuery(query, { orderBy: 'startDate' });
    }),
  );
  return results.flat();
}
