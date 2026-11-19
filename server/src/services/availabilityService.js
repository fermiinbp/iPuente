// Reglas de disponibilidad de una sala. Bloquean una franja las reservas CONFIRMED y los bloqueos
// de la empresa (blocks); el resto de estados no cuentan. Calcula las horas libres de un día y,
// dentro de una transacción de Firestore, comprueba que una franja nueva no solape con nada.
// Las franjas son { inicio, fin } en horas enteras (0-24) del mismo día.
import * as blockModel from '../models/blockModel.js';
import * as bookingModel from '../models/bookingModel.js';
import { dayRange } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';

// Horario reservable acordado: de 8:00 a 20:00 (la última hora libre empieza a las 19).
export const BOOKING_HOURS = { desde: 8, hasta: 20 };

// Estado de una sala en un día (los mismos que el front, client/src/config/constants.js).
export const ROOM_STATUS = { FREE: 'FREE', OCCUPIED: 'OCCUPIED', UNAVAILABLE: 'UNAVAILABLE' };

// Dos franjas solapan si cada una empieza antes de que acabe la otra (las contiguas no solapan).
export function overlaps(a, b) {
  return a.inicio < b.fin && a.fin > b.inicio;
}

// Un bloqueo siempre ocupa; una reserva solo si está CONFIRMED.
export function isActive(item) {
  return item.tipo === 'bloqueo' || (item.tipo === 'reserva' && item.status === 'CONFIRMED');
}

// Horas libres [h, h+1) entre desde y hasta que no solapan con ningún item activo.
export function freeSlots(items, { desde = 8, hasta = 21 } = {}) {
  const active = items.filter(isActive);
  const free = [];
  for (let h = desde; h < hasta; h++) {
    if (!active.some((item) => overlaps({ inicio: h, fin: h + 1 }, item))) free.push(h);
  }
  return free;
}

// Convierte un Date o un Timestamp de Firestore en Date.
export const toDate = (value) => (typeof value.toDate === 'function' ? value.toDate() : value);

// Convierte un documento del model en una franja { tipo, status, inicio, fin } de horas enteras.
export function toSlot(doc, tipo) {
  const start = toDate(doc.startDate);
  const end = toDate(doc.endDate);
  const nextDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const fin = end.getTime() >= nextDay.getTime() ? 24 : end.getHours();
  return { tipo, status: doc.status, inicio: start.getHours(), fin };
}

// Lanza 409 SLOT_TAKEN si la franja pedida solapa con una reserva CONFIRMED o un bloqueo.
// fecha es 'AAAA-MM-DD'; los models se pueden sustituir por dobles en los tests.
export async function assertSlotAvailable(
  roomId,
  fecha,
  inicio,
  fin,
  tx,
  { bookings = bookingModel, blocks = blockModel } = {},
) {
  const { from, to } = dayRange(fecha);
  const [reservas, bloqueos] = await Promise.all([
    bookings.listByRoom(roomId, { from, to, tx }),
    blocks.listByRoom(roomId, { from, to, tx }),
  ]);
  const items = [
    ...reservas.map((doc) => toSlot(doc, 'reserva')),
    ...bloqueos.map((doc) => toSlot(doc, 'bloqueo')),
  ];
  if (items.filter(isActive).some((item) => overlaps({ inicio, fin }, item))) {
    throw new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada');
  }
}

// Lee sin transacción las reservas y bloqueos de una sala en un día y los devuelve como franjas.
export async function getDayItems(
  roomId,
  fecha,
  { bookings = bookingModel, blocks = blockModel } = {},
) {
  const { from, to } = dayRange(fecha);
  const [reservas, bloqueos] = await Promise.all([
    bookings.listByRoom(roomId, { from, to }),
    blocks.listByRoom(roomId, { from, to }),
  ]);
  return [
    ...reservas.map((doc) => toSlot(doc, 'reserva')),
    ...bloqueos.map((doc) => toSlot(doc, 'bloqueo')),
  ];
}

// Una sala se puede reservar si existe, es reservable, está activa y tiene precio mayor que 0.
export function isBookable(room) {
  return (
    Boolean(room) &&
    room.bookable === true &&
    room.status === 'ACTIVE' &&
    typeof room.price === 'number' &&
    room.price > 0
  );
}

// Estado de una sala en una hora concreta: UNAVAILABLE si no es reservable, OCCUPIED si algún
// item activo solapa con [hora, hora + 1), si no FREE.
export function roomStatusAtHour(room, items, hora) {
  if (!isBookable(room)) return ROOM_STATUS.UNAVAILABLE;
  const slot = { inicio: hora, fin: hora + 1 };
  return items.filter(isActive).some((item) => overlaps(slot, item))
    ? ROOM_STATUS.OCCUPIED
    : ROOM_STATUS.FREE;
}

// Estado de una sala un día: UNAVAILABLE si no es reservable, OCCUPIED si hay algo activo, si no FREE.
export function roomStatus(room, items) {
  if (!isBookable(room)) return ROOM_STATUS.UNAVAILABLE;
  return items.some(isActive) ? ROOM_STATUS.OCCUPIED : ROOM_STATUS.FREE;
}
