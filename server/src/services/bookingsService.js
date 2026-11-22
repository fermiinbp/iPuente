// Crear, listar y cancelar reservas del cliente. Hoy nacen CONFIRMED (sin pago online); con la
// opción interna `pendingPayment` nacen PENDING_PAYMENT con expiresAt a +15 min (salvo las de 0 €).
// El servidor calcula pricePeriod y totalAmount a partir del price de la sala; occupancy bloquea
// cada hora. Una pendiente vencida se muestra como EXPIRED y se expira al reservar sobre ella.
import { BOOKING_HOURS, PENDING_MINUTES } from '../config/bookingHours.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as buildingModel from '../models/buildingModel.js';
import * as counterModel from '../models/counterModel.js';
import * as floorModel from '../models/floorModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import {
  assertSlotAvailable,
  effectivePrice,
  effectiveStatus,
  isBookable,
  isPendingExpired,
  toDate,
  toMillis,
  toSlot,
} from './availabilityService.js';
import { readSlotPlan, releaseSlots, slotIds, writeSlotClaims } from './occupancyService.js';
import { findPublicRoom } from './roomsService.js';

// Date local de una fecha AAAA-MM-DD a una hora (24 pasa al día siguiente a las 00:00).
export function atHour(fecha, hour) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

// Datos públicos de una reserva a partir de su documento. El estado es el efectivo: una pendiente
// vencida sale como EXPIRED aunque Firestore aún diga PENDING_PAYMENT. Una pendiente vigente añade
// `expiraEn` (ISO).
export function toItem(booking) {
  const { inicio, fin } = toSlot(booking, 'reserva');
  const estado = effectiveStatus(booking);
  return {
    id: booking.id,
    codigo: booking.code ?? null,
    roomId: booking.roomId,
    fecha: todayString(toDate(booking.startDate)),
    inicio,
    fin,
    horas: fin - inicio,
    precioHora: booking.price,
    importe: booking.totalAmount,
    estado,
    ...(estado === 'PENDING_PAYMENT' && Number.isFinite(toMillis(booking.expiresAt))
      ? { expiraEn: new Date(toMillis(booking.expiresAt)).toISOString() }
      : {}),
  };
}

// Código legible secuencial de las reservas: IP-1000, IP-1001... (el contador guarda el último).
const CODE_PREFIX = 'IP-';
const FIRST_CODE_NUMBER = 1000;

// Quién canceló, en español, a partir del valor guardado en la reserva.
const CANCELLED_BY = { CLIENT: 'cliente', COMPANY: 'empresa' };

// Datos de cancelación de una reserva (motivo y quién); vacío si no está cancelada.
export function toCancellation(booking) {
  if (booking.status !== 'CANCELLED') return {};
  return {
    motivoCancelacion: booking.cancelReason ?? null,
    canceladaPor: CANCELLED_BY[booking.cancelledBy] ?? null,
  };
}

// Detalle de una reserva con su sala, planta y edificio (lo que falte o se haya borrado es null).
// Nunca incluye userId ni companyId. Si el llamador ya leyó la sala, la pasa en `room` (null si no
// existe) y no se vuelve a leer.
export async function buildBookingDetail(booking, { room: knownRoom } = {}) {
  const room = knownRoom === undefined ? await roomModel.findById(booking.roomId) : knownRoom;
  const floorId = room?.floorId;
  const buildingId = room?.buildingId;
  const [floor, building] = await Promise.all([
    floorId ? floorModel.findById(floorId) : null,
    buildingId ? buildingModel.findById(buildingId) : null,
  ]);
  return {
    ...toItem(booking),
    sala: room ? { id: room.id, codigo: room.code ?? null, nombre: room.name ?? null } : null,
    planta: floor ? { id: floor.id, nombre: floor.name ?? null, nivel: floor.level ?? null } : null,
    edificio: building
      ? {
          id: building.id,
          nombre: building.name ?? null,
          direccion: building.address ?? null,
          ciudad: building.city ?? null,
        }
      : null,
    ...toCancellation(booking),
  };
}

// Comprueba que la sala admite reservas y que la franja está dentro del horario.
function assertBookable(room, inicio, fin) {
  if (!isBookable(room)) {
    throw new HttpError(400, 'ROOM_NOT_BOOKABLE', 'Esta sala no se puede reservar');
  }
  if (inicio < BOOKING_HOURS.desde || fin > BOOKING_HOURS.hasta) {
    throw new HttpError(
      400,
      'OUT_OF_HOURS',
      `La franja debe estar entre las ${BOOKING_HOURS.desde}:00 y las ${BOOKING_HOURS.hasta}:00`,
    );
  }
}

// Traduce errores de Firestore: «el documento ya existe» a 409 SLOT_TAKEN y la contención de la
// transacción (ABORTED, code 10) a 409 BUSY.
export function translateConflict(err) {
  const message = err?.message ?? '';
  const exists =
    err?.code === 6 || err?.code === 'already-exists' || /ALREADY_EXISTS/.test(message);
  if (exists) return new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada');
  const aborted = err?.code === 10 || err?.code === 'aborted' || /ABORTED/.test(message);
  if (aborted) {
    return new HttpError(409, 'BUSY', 'Hay mucha demanda en este momento; inténtalo de nuevo');
  }
  return err;
}

// Crea una reserva y bloquea cada hora, todo en una transacción. Por defecto nace CONFIRMED; con
// { pendingPayment: true } nace PENDING_PAYMENT con expiresAt a +15 min, salvo si importa 0 €
// (sala gratis), que se confirma siempre. Nadie activa la opción todavía.
export async function createBooking(
  uid,
  { roomId, fecha, inicio, fin },
  { pendingPayment = false } = {},
) {
  // Fuera de la transacción: 404 si la sala, su planta o su edificio no están publicados.
  const { room: publicRoom } = await findPublicRoom(roomId);
  assertBookable(publicRoom, inicio, fin);
  const horas = fin - inicio;
  let room;
  let importe;
  let codigo;
  let estado = 'CONFIRMED';
  let expiresAt;
  try {
    let number;
    const id = await runTransaction(async (tx) => {
      // Se vuelven a leer la sala, su planta, su edificio y su empresa dentro de la transacción:
      // si se cambia el precio, se oculta, se despublica o se suspende la empresa mientras
      // tanto, la reserva usa los datos del momento del commit (404 si ya no son públicos).
      ({ room } = await findPublicRoom(roomId, { tx }));
      assertBookable(room, inicio, fin);
      const precio = effectivePrice(room);
      if (precio === null || !Number.isFinite(precio)) {
        throw new HttpError(400, 'ROOM_NOT_BOOKABLE', 'Esta sala no se puede reservar');
      }
      importe = precio * horas;
      await assertSlotAvailable(roomId, fecha, inicio, fin, tx);
      // Todas las lecturas van antes que las escrituras: el contador y las fichas se leen aquí.
      const plan = await readSlotPlan(roomId, fecha, inicio, fin, { tx });
      const last = await counterModel.getValue('bookings', { tx });
      number = Math.max(last, FIRST_CODE_NUMBER - 1) + 1;
      codigo = `${CODE_PREFIX}${number}`;
      const pending = pendingPayment && importe > 0;
      estado = pending ? 'PENDING_PAYMENT' : 'CONFIRMED';
      expiresAt = pending ? new Date(Date.now() + PENDING_MINUTES * 60 * 1000) : undefined;
      const bookingId = await bookingModel.create(
        {
          code: codigo,
          userId: uid,
          companyId: room.companyId,
          roomId,
          startDate: atHour(fecha, inicio),
          endDate: atHour(fecha, fin),
          price: effectivePrice(room),
          pricePeriod: 'HOUR',
          totalAmount: importe,
          status: estado,
          paymentId: null,
          ...(expiresAt && { expiresAt }),
        },
        { tx },
      );
      await counterModel.setValue('bookings', number, { tx });
      await writeSlotClaims(
        plan,
        { companyId: room.companyId, roomId, fecha, inicio, owner: { bookingId } },
        tx,
      );
      return bookingId;
    });
    return {
      id,
      codigo,
      roomId,
      fecha,
      inicio,
      fin,
      horas,
      precioHora: effectivePrice(room),
      importe,
      estado,
      ...(expiresAt && { expiraEn: expiresAt.toISOString() }),
    };
  } catch (err) {
    throw translateConflict(err);
  }
}

// Reservas del usuario: próximas (no han acabado, por inicio asc) y pasadas (por inicio desc).
export async function listMyBookings(uid) {
  const bookings = await bookingModel.listByUser(uid);
  const roomIds = [...new Set(bookings.map((b) => b.roomId))];
  const rooms = await Promise.all(roomIds.map((id) => roomModel.findById(id)));
  const byId = new Map(roomIds.map((id, i) => [id, rooms[i]]));
  const ahora = Date.now();
  const items = bookings.map((b) => {
    const room = byId.get(b.roomId);
    return {
      start: toDate(b.startDate).getTime(),
      end: toDate(b.endDate).getTime(),
      item: { ...toItem(b), sala: room ? { nombre: room.name, codigo: room.code } : null },
    };
  });
  // Una pendiente vencida (EXPIRED) ya no es una próxima reserva aunque su hora no haya pasado.
  const vivas = (i) => i.end > ahora && i.item.estado !== 'EXPIRED';
  const proximas = items.filter(vivas).sort((a, b) => a.start - b.start);
  const pasadas = items.filter((i) => !vivas(i)).sort((a, b) => b.start - a.start);
  return { proximas: proximas.map((i) => i.item), pasadas: pasadas.map((i) => i.item) };
}

// 404 NOT_FOUND si la reserva no existe o es de otro usuario (mismo error, para no revelarla).
function assertBookingOfUser(booking, uid) {
  if (!booking || booking.userId !== uid) {
    throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
  }
}

// Comprueba existencia, propietario, estado y que no haya empezado; lanza el error que toque.
// Se cancelan las CONFIRMED y las PENDING_PAYMENT vigentes. Una pendiente vencida (o EXPIRED) da
// 400 BOOKING_NOT_CANCELLABLE como cualquier estado no cancelable, con mensaje propio: no hay nada
// que cancelar ni que liberar, y así no parece que se haya cancelado algo vivo.
function assertCancellable(booking, uid) {
  assertBookingOfUser(booking, uid);
  const estado = effectiveStatus(booking);
  if (estado === 'EXPIRED') {
    throw new HttpError(
      400,
      'BOOKING_NOT_CANCELLABLE',
      'La reserva ha caducado y ya no se puede cancelar',
    );
  }
  if (estado !== 'CONFIRMED' && estado !== 'PENDING_PAYMENT') {
    throw new HttpError(
      400,
      'BOOKING_NOT_CANCELLABLE',
      'Solo se pueden cancelar reservas confirmadas o pendientes de pago',
    );
  }
  if (toDate(booking.startDate).getTime() <= Date.now()) {
    throw new HttpError(
      400,
      'BOOKING_STARTED',
      'No se puede cancelar una reserva que ya ha empezado',
    );
  }
}

// Cancela una reserva propia y libera sus horas de occupancy en una transacción. Solo borra las
// fichas cuyo bookingId es el de esta reserva (nunca la de otra reserva o bloqueo).
export async function cancelBooking(uid, id) {
  await runTransaction(async (tx) => {
    const booking = await bookingModel.findById(id, { tx });
    assertCancellable(booking, uid);
    const fecha = todayString(toDate(booking.startDate));
    const { inicio, fin } = toSlot(booking, 'reserva');
    const ids = slotIds(booking.roomId, fecha, inicio, fin);
    const slots = await Promise.all(ids.map((slot) => occupancyModel.findById(slot, { tx })));
    await bookingModel.update(
      id,
      { status: 'CANCELLED', cancelledAt: now(), cancelledBy: 'CLIENT' },
      { tx },
    );
    await releaseSlots(ids, slots, 'bookingId', id, tx);
  });
  return { id, estado: 'CANCELLED' };
}

// Alarga expiresAt de una reserva en una transacción, solo si sigue PENDING_PAYMENT y vigente
// (la usará el pago al crear la sesión de Checkout). Nunca lo acorta (si ya es posterior, no
// escribe) y no toca su occupancy. 404 si no existe, 409 BOOKING_NOT_PENDING si ya no está
// pendiente y 409 BOOKING_EXPIRED si venció. Devuelve el expiresAt resultante (Date).
export async function extendPendingExpiry(id, expiresAt, { clock = Date.now } = {}) {
  return runTransaction(async (tx) => {
    const booking = await bookingModel.findById(id, { tx });
    if (!booking) throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new HttpError(409, 'BOOKING_NOT_PENDING', 'La reserva no está pendiente de pago');
    }
    if (isPendingExpired(booking, clock())) {
      throw new HttpError(409, 'BOOKING_EXPIRED', 'La reserva ha caducado');
    }
    const current = toMillis(booking.expiresAt);
    if (Number.isFinite(current) && current >= expiresAt.getTime()) return new Date(current);
    await bookingModel.update(id, { expiresAt }, { tx });
    return expiresAt;
  });
}

// Detalle de una reserva propia: 404 si no existe o es de otro usuario.
export async function getMyBooking(uid, id) {
  const booking = await bookingModel.findById(id);
  assertBookingOfUser(booking, uid);
  return buildBookingDetail(booking);
}
