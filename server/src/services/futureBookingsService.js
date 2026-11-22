// Reservas futuras de unas salas: sirve para avisar al despublicar o ocultar (no bloquea nada).
import * as bookingModel from '../models/bookingModel.js';
import { effectiveStatus, toDate } from './availabilityService.js';

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'PENDING_PAYMENT']);

// ¿La reserva está viva (CONFIRMED o PENDING_PAYMENT vigente, no vencida) y empieza después de nowMs?
export function isActiveFuture(booking, nowMs = Date.now()) {
  return (
    ACTIVE_STATUSES.has(effectiveStatus(booking, nowMs)) &&
    toDate(booking.startDate).getTime() > nowMs
  );
}

// Nº de reservas CONFIRMED o PENDING_PAYMENT vigentes que empiezan después de ahora en las salas dadas.
export async function countFutureBookings(roomIds) {
  const from = new Date();
  const lists = await Promise.all(roomIds.map((id) => bookingModel.listByRoom(id, { from })));
  return lists.flat().filter((b) => isActiveFuture(b, from.getTime())).length;
}

// Texto de aviso en español si hay reservas futuras; si no, undefined.
export function futureBookingsNotice(count, where) {
  if (count <= 0) return undefined;
  const reservas = count === 1 ? '1 reserva futura' : `${count} reservas futuras`;
  const verbo =
    count === 1
      ? 'sigue en pie y su cliente la conserva'
      : 'siguen en pie y sus clientes las conservan';
  return `Hay ${reservas} en ${where}; ${verbo}`;
}

// Une avisos sueltos en un solo texto (undefined si no hay ninguno).
export function joinNotices(...notices) {
  const list = notices.filter(Boolean);
  return list.length > 0 ? list.join('. ') : undefined;
}
