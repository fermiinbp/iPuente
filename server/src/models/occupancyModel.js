// Acceso a la colección occupancy: una ficha por sala y hora ocupada, con id fijo «roomId_AAAA-MM-DD_HH».
// Como el id es único, dos reservas no pueden crear la misma hora: create falla si ya existe (útil dentro de una transacción).
// Campos: companyId, roomId, date (AAAA-MM-DD), hour (0-23), bookingId o blockId, createdAt, updatedAt.
import { createModel, now, runQuery } from './baseModel.js';

const base = createModel('occupancy');

export const { findById, create, upsert, update, remove } = base;

// Id del documento de una sala en una fecha y hora: «p0-s01_2026-11-18_09».
export function slotId(roomId, date, hour) {
  return `${roomId}_${date}_${String(hour).padStart(2, '0')}`;
}

// Horas ocupadas de una sala en un día, ordenadas.
export async function listByRoomAndDate(roomId, date) {
  const query = base.collection().where('roomId', '==', roomId).where('date', '==', date);
  const slots = await runQuery(query);
  return slots.sort((a, b) => a.hour - b.hour);
}

// Sustituye (set completo) la ficha de una hora que pertenecía a otra reserva caducada. Solo dentro
// de una transacción: así borrar la vieja y crear la nueva es una única escritura atómica.
export function overwrite(data, { id, tx }) {
  tx.set(base.docRef(id), { ...data, createdAt: now(), updatedAt: now() });
  return id;
}

export function listByBooking(bookingId) {
  return base.listBy('bookingId', bookingId);
}

export function listByBlock(blockId) {
  return base.listBy('blockId', blockId);
}

// Libera todas las horas de una reserva (al cancelarla o caducar). Devuelve cuántas ha borrado.
export async function removeByBooking(bookingId) {
  const slots = await listByBooking(bookingId);
  await Promise.all(slots.map((slot) => base.remove(slot.id)));
  return slots.length;
}
