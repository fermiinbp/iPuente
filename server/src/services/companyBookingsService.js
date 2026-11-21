// Reservas y bloqueos del panel de empresa: listar reservas, crear y quitar bloqueos de horas y
// cancelar reservas de sus salas. El companyId siempre sale del token; nada se confía al body.
import { now, runTransaction } from '../models/baseModel.js';
import * as blockModel from '../models/blockModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as roomModel from '../models/roomModel.js';
import * as userModel from '../models/userModel.js';
import { addDays, resolveRange, todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { BOOKING_HOURS } from '../config/bookingHours.js';
import { assertSlotAvailable, toDate, toSlot } from './availabilityService.js';
import { readSlotPlan, releaseSlots, slotIds, writeSlotClaims } from './occupancyService.js';
import { isActiveFuture } from './futureBookingsService.js';
import {
  atHour,
  buildBookingDetail,
  toCancellation,
  toItem,
  translateConflict,
} from './bookingsService.js';
import { assertBookingOwned, assertOwnedBy, getOwnedRoom } from './ownershipService.js';

// Lee las salas indicadas una sola vez cada una y devuelve un Map id -> sala.
async function loadRooms(ids) {
  const unique = [...new Set(ids)];
  const rooms = await Promise.all(unique.map((id) => roomModel.findById(id)));
  return new Map(unique.map((id, i) => [id, rooms[i]]));
}

// Tope de reservas futuras que devuelve el listado de una sala.
const MAX_FUTURE = 500;

// Datos mínimos de una sala para las respuestas.
export const toSala = (room) => (room ? { nombre: room.name, codigo: room.code } : null);

// Nombre y email del cliente (sin id ni más datos personales).
export const toCliente = (user) =>
  user ? { nombre: user.name ?? null, email: user.email ?? null } : null;

// Rango [from, to) en Date para la consulta, a partir de desde y hasta (inclusive) con sus
// valores por defecto (desde = hoy - 30 días, hasta = desde + 90 días).
function queryRange(filters) {
  const { desde, hasta } = resolveRange(filters);
  return { from: atHour(desde, 0), to: atHour(addDays(hasta, 1), 0) };
}

// Ordena por fecha e inicio ascendentes.
const byDate = (a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio;

// Si viene roomId comprueba que es de la empresa (404/403; una sala eliminada lógicamente sigue
// consultable por su historial); sin roomId no filtra por sala.
async function checkRoomFilter(roomId, companyId) {
  if (roomId) await getOwnedRoom(roomId, companyId, { includeDeleted: true });
}

// Reservas de la empresa en el rango pedido (por defecto hoy - 30 días y 90 días desde ahí; máximo
// 366 días y 500 resultados). Solo se devuelven las de salas que de verdad son de la empresa y solo
// entonces se leen sus clientes.
export async function listBookings(companyId, { desde, hasta, roomId } = {}) {
  await checkRoomFilter(roomId, companyId);
  const bookings = (
    await bookingModel.listByCompanyInRange(companyId, queryRange({ desde, hasta }))
  ).filter((b) => b.companyId === companyId && (!roomId || b.roomId === roomId));
  const rooms = await loadRooms(bookings.map((b) => b.roomId));
  const items = bookings
    .filter((b) => rooms.get(b.roomId)?.companyId === companyId)
    .map((booking) => ({ booking, item: toItem(booking) }));
  const userIds = [...new Set(items.map(({ booking }) => booking.userId).filter(Boolean))];
  const users = await Promise.all(userIds.map((id) => userModel.findById(id)));
  const usersById = new Map(userIds.map((id, i) => [id, users[i]]));
  return items
    .map(({ booking, item }) => {
      const user = usersById.get(booking.userId);
      return {
        ...item,
        sala: toSala(rooms.get(booking.roomId)),
        cliente: toCliente(user),
        ...toCancellation(booking),
      };
    })
    .sort(byDate);
}

// Reservas futuras (CONFIRMED o PENDING_PAYMENT, con inicio posterior a ahora) de una sala propia,
// por inicio ascendente y como mucho 500: las que bloquean eliminarla. 404/403 si la sala no es
// propia o ya está eliminada. Mismo formato que el listado de reservas (cliente con nombre y email).
export async function listFutureBookings(companyId, roomId) {
  const room = await getOwnedRoom(roomId, companyId);
  const nowMs = Date.now();
  // La consulta ya va limitada por fecha (desde ahora, las más próximas, máx. 500); los estados
  // se filtran en memoria, así que no hace falta un índice nuevo.
  const bookings = (
    await bookingModel.listByRoom(roomId, { from: new Date(nowMs), limit: MAX_FUTURE })
  ).filter((b) => b.companyId === companyId && isActiveFuture(b, nowMs));
  const userIds = [...new Set(bookings.map((b) => b.userId).filter(Boolean))];
  const users = await Promise.all(userIds.map((id) => userModel.findById(id)));
  const usersById = new Map(userIds.map((id, i) => [id, users[i]]));
  return bookings.map((booking) => ({
    ...toItem(booking),
    sala: toSala(room),
    cliente: toCliente(usersById.get(booking.userId)),
  }));
}

// Detalle de una reserva de la empresa: 404 NOT_FOUND si no existe o es de otra empresa (la reserva
// o su sala), sin distinguir los casos. Incluye nombre y email del cliente, nunca su id.
export async function getBooking(companyId, id) {
  const booking = assertBookingOwned(await bookingModel.findById(id), companyId);
  const room = await roomModel.findById(booking.roomId);
  if (room) assertBookingOwned(room, companyId);
  const user = booking.userId ? await userModel.findById(booking.userId) : null;
  return { ...(await buildBookingDetail(booking, { room })), cliente: toCliente(user) };
}

// Formato público de un bloqueo.
function toBlockItem(block, room) {
  const { inicio, fin } = toSlot(block, 'bloqueo');
  return {
    id: block.id,
    roomId: block.roomId,
    sala: toSala(room),
    fecha: todayString(toDate(block.startDate)),
    inicio,
    fin,
    motivo: block.reason,
  };
}

// Bloqueos de la empresa, con el mismo rango y filtros que las reservas. Descarta los de salas ajenas.
export async function listBlocks(companyId, { desde, hasta, roomId } = {}) {
  await checkRoomFilter(roomId, companyId);
  const blocks = (
    await blockModel.listByCompanyInRange(companyId, queryRange({ desde, hasta }))
  ).filter((b) => b.companyId === companyId && (!roomId || b.roomId === roomId));
  const rooms = await loadRooms(blocks.map((b) => b.roomId));
  return blocks
    .filter((b) => rooms.get(b.roomId)?.companyId === companyId)
    .map((b) => toBlockItem(b, rooms.get(b.roomId)))
    .sort(byDate);
}

// Bloquea horas de una sala propia. Misma protección contra carreras que una reserva: comprueba
// solapes y crea una ficha de occupancy por hora (id fijo) en una transacción.
export async function createBlock(companyId, { roomId, fecha, inicio, fin, motivo }) {
  await getOwnedRoom(roomId, companyId);
  if (inicio < BOOKING_HOURS.desde || fin > BOOKING_HOURS.hasta) {
    throw new HttpError(
      400,
      'OUT_OF_HOURS',
      `La franja debe estar entre las ${BOOKING_HOURS.desde}:00 y las ${BOOKING_HOURS.hasta}:00`,
    );
  }
  try {
    let room;
    const id = await runTransaction(async (tx) => {
      room = assertOwnedBy(await roomModel.findById(roomId, { tx }), companyId);
      await assertSlotAvailable(roomId, fecha, inicio, fin, tx);
      // Lecturas de occupancy antes de escribir; una pendiente vencida se expira y se sustituye.
      const plan = await readSlotPlan(roomId, fecha, inicio, fin, { tx });
      const blockId = await blockModel.create(
        {
          companyId,
          roomId,
          startDate: atHour(fecha, inicio),
          endDate: atHour(fecha, fin),
          reason: motivo,
        },
        { tx },
      );
      await writeSlotClaims(plan, { companyId, roomId, fecha, inicio, owner: { blockId } }, tx);
      return blockId;
    });
    return { id, roomId, sala: toSala(room), fecha, inicio, fin, motivo };
  } catch (err) {
    throw translateConflict(err);
  }
}

// Borra un bloqueo propio y libera sus horas de occupancy en una transacción.
export async function removeBlock(companyId, id) {
  await runTransaction(async (tx) => {
    const block = assertOwnedBy(await blockModel.findById(id, { tx }), companyId);
    const fecha = todayString(toDate(block.startDate));
    const { inicio, fin } = toSlot(block, 'bloqueo');
    const ids = slotIds(block.roomId, fecha, inicio, fin);
    const slots = await Promise.all(ids.map((slot) => occupancyModel.findById(slot, { tx })));
    await blockModel.remove(id, { tx });
    await releaseSlots(ids, slots, 'blockId', id, tx);
  });
  return { id, borrado: true };
}

// Cancela una reserva de una sala de la empresa (solo CONFIRMED y que no haya empezado) y libera
// sus horas. No gestiona reembolsos: todavía no hay pago online.
export async function cancelBooking(companyId, id, motivo) {
  await runTransaction(async (tx) => {
    const booking = assertBookingOwned(await bookingModel.findById(id, { tx }), companyId);
    // Defensa en profundidad: la sala de la reserva también debe ser de la empresa.
    assertBookingOwned(await roomModel.findById(booking.roomId, { tx }), companyId);
    if (booking.status !== 'CONFIRMED') {
      throw new HttpError(
        400,
        'BOOKING_NOT_CANCELLABLE',
        'Solo se pueden cancelar reservas confirmadas',
      );
    }
    if (toDate(booking.startDate).getTime() <= Date.now()) {
      throw new HttpError(
        400,
        'BOOKING_STARTED',
        'No se puede cancelar una reserva que ya ha empezado',
      );
    }
    const fecha = todayString(toDate(booking.startDate));
    const { inicio, fin } = toSlot(booking, 'reserva');
    const ids = slotIds(booking.roomId, fecha, inicio, fin);
    const slots = await Promise.all(ids.map((slot) => occupancyModel.findById(slot, { tx })));
    await bookingModel.update(
      id,
      { status: 'CANCELLED', cancelledAt: now(), cancelledBy: 'COMPANY', cancelReason: motivo },
      { tx },
    );
    await releaseSlots(ids, slots, 'bookingId', id, tx);
  });
  return { id, estado: 'CANCELLED', motivo };
}
