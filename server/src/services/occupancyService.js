// Fichas de occupancy de una reserva o un bloqueo: reservar una franja (sustituyendo las de una
// reserva PENDING_PAYMENT vencida, que pasa a EXPIRED) y liberarla sin tocar fichas de otros.
// Todo recibe `tx`: las lecturas (readSlotPlan) van antes que las escrituras (writeSlotClaims).
import * as bookingModel from '../models/bookingModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { effectiveStatus, toDate, toSlot } from './availabilityService.js';

// Ids de las fichas de occupancy de una sala, fecha y franja [inicio, fin).
export function slotIds(roomId, fecha, inicio, fin) {
  const ids = [];
  for (let hour = inicio; hour < fin; hour++) ids.push(occupancyModel.slotId(roomId, fecha, hour));
  return ids;
}

// Borra solo las fichas leídas que pertenecen a este bloqueo o reserva (campo === id).
export async function releaseSlots(ids, slots, field, id, tx) {
  for (let i = 0; i < ids.length; i++) {
    if (slots[i]?.[field] === id) await occupancyModel.remove(ids[i], { tx });
  }
}

// Lee las fichas de una reserva y devuelve los ids de las que de verdad son suyas.
async function readOwnSlots(booking, tx) {
  const fecha = todayString(toDate(booking.startDate));
  const { inicio, fin } = toSlot(booking, 'reserva');
  const ids = slotIds(booking.roomId, fecha, inicio, fin);
  const docs = await Promise.all(ids.map((id) => occupancyModel.findById(id, { tx })));
  return ids.filter((_id, i) => docs[i]?.bookingId === booking.id);
}

// Lecturas previas para reservar [inicio, fin) de una sala: devuelve el plan { ids, taken, stale }.
// Una ficha ya existente solo se puede sustituir si su reserva existe y ya no ocupa (estado
// efectivo distinto de CONFIRMED y de PENDING_PAYMENT vigente): `stale` lleva esa reserva, el resto
// de sus fichas fuera de la franja (a liberar) y `expire` (true solo si era una pendiente vencida;
// una CANCELLED, EXPIRED o COMPLETED nunca cambia de estado). Si es de una reserva viva, de un
// bloqueo o de una reserva que no existe: 409 SLOT_TAKEN.
export async function readSlotPlan(roomId, fecha, inicio, fin, { tx, nowMs = Date.now() }) {
  const ids = slotIds(roomId, fecha, inicio, fin);
  const docs = await Promise.all(ids.map((id) => occupancyModel.findById(id, { tx })));
  const taken = new Set();
  const bookingIds = new Set();
  docs.forEach((doc, i) => {
    if (!doc) return;
    if (!doc.bookingId) throw new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada');
    taken.add(ids[i]);
    bookingIds.add(doc.bookingId);
  });
  const stale = [];
  for (const bookingId of bookingIds) {
    const booking = await bookingModel.findById(bookingId, { tx });
    const status = effectiveStatus(booking, nowMs);
    if (booking?.id !== bookingId || status === 'CONFIRMED' || status === 'PENDING_PAYMENT') {
      throw new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada');
    }
    const own = await readOwnSlots(booking, tx);
    stale.push({
      id: booking.id,
      expire: booking.status === 'PENDING_PAYMENT',
      release: own.filter((id) => !ids.includes(id)),
    });
  }
  return { ids, taken, stale };
}

// Escrituras del plan: pasa a EXPIRED las pendientes vencidas (las demás conservan su estado),
// libera las fichas de esas reservas fuera de la franja, sustituye las de la franja y crea las que faltan. `owner` es { bookingId } o { blockId }.
export async function writeSlotClaims(plan, { companyId, roomId, fecha, inicio, owner }, tx) {
  for (const old of plan.stale) {
    if (old.expire) await bookingModel.update(old.id, { status: 'EXPIRED' }, { tx });
    for (const id of old.release) await occupancyModel.remove(id, { tx });
  }
  for (let i = 0; i < plan.ids.length; i++) {
    const id = plan.ids[i];
    const data = { companyId, roomId, date: fecha, hour: inicio + i, ...owner };
    if (plan.taken.has(id)) occupancyModel.overwrite(data, { id, tx });
    else await occupancyModel.create(data, { id, tx });
  }
}

// Lecturas previas para recuperar las horas de una reserva ya vencida o expirada que se ha pagado
// tarde. Cada hora debe estar libre, ser de la propia reserva o tener una ficha sustituible con la
// misma regla que readSlotPlan: de otra reserva que existe (mismo id) y ya no ocupa (estado efectivo
// distinto de CONFIRMED y de PENDING_PAYMENT vigente). Un bloqueo, una reserva viva o una que no
// existe dan 409 SLOT_TAKEN. Devuelve { fecha, missing, replace, stale } (fichas por crear, por
// sustituir y reservas viejas a expirar o limpiar).
export async function readReclaimPlan(booking, { tx, nowMs = Date.now() }) {
  const fecha = todayString(toDate(booking.startDate));
  const { inicio, fin } = toSlot(booking, 'reserva');
  const ids = slotIds(booking.roomId, fecha, inicio, fin);
  const docs = await Promise.all(ids.map((id) => occupancyModel.findById(id, { tx })));
  const missing = [];
  const replace = [];
  const otherIds = new Set();
  docs.forEach((doc, i) => {
    const slot = { id: ids[i], hour: inicio + i };
    if (!doc) missing.push(slot);
    else if (doc.bookingId === booking.id) return;
    else if (!doc.bookingId) throw new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada');
    else {
      replace.push(slot);
      otherIds.add(doc.bookingId);
    }
  });
  const stale = [];
  for (const otherId of otherIds) {
    const other = await bookingModel.findById(otherId, { tx });
    const status = effectiveStatus(other, nowMs);
    if (other?.id !== otherId || status === 'CONFIRMED' || status === 'PENDING_PAYMENT') {
      throw new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada');
    }
    const own = await readOwnSlots(other, tx);
    stale.push({
      id: other.id,
      expire: other.status === 'PENDING_PAYMENT',
      release: own.filter((id) => !ids.includes(id)),
    });
  }
  return { fecha, missing, replace, stale };
}

// Escrituras del plan de readReclaimPlan: expira las pendientes vencidas que ocupaban, libera sus
// otras fichas, sustituye las de la franja y crea las que faltan, todo a nombre de la reserva.
export async function writeReclaimClaims(plan, booking, tx) {
  for (const old of plan.stale) {
    if (old.expire) await bookingModel.update(old.id, { status: 'EXPIRED' }, { tx });
    for (const id of old.release) await occupancyModel.remove(id, { tx });
  }
  const data = (hour) => ({
    companyId: booking.companyId,
    roomId: booking.roomId,
    date: plan.fecha,
    hour,
    bookingId: booking.id,
  });
  for (const { id, hour } of plan.replace) occupancyModel.overwrite(data(hour), { id, tx });
  for (const { id, hour } of plan.missing) await occupancyModel.create(data(hour), { id, tx });
}
