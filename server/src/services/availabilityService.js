// Reglas de disponibilidad de una sala. Bloquean una franja las reservas CONFIRMED y los bloqueos
// de la empresa (blocks); el resto de estados no cuentan. Calcula las horas libres de un día y,
// dentro de una transacción de Firestore, comprueba que una franja nueva no solape con nada.
// Las franjas son { inicio, fin } en horas enteras (0-24) del mismo día.
import * as blockModel from '../models/blockModel.js';
import * as bookingModel from '../models/bookingModel.js';
import { HttpError } from '../utils/httpError.js';

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
const toDate = (value) => (typeof value.toDate === 'function' ? value.toDate() : value);

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
  const [y, m, d] = fecha.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const to = new Date(y, m - 1, d + 1);
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
