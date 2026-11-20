// Crear, listar y cancelar reservas del cliente (sin pago online: nacen CONFIRMED). El servidor
// calcula pricePeriod y totalAmount a partir del price de la sala; occupancy bloquea cada hora.
import { BOOKING_HOURS } from '../config/bookingHours.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as buildingModel from '../models/buildingModel.js';
import * as counterModel from '../models/counterModel.js';
import * as floorModel from '../models/floorModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { assertSlotAvailable, isBookable, toDate, toSlot } from './availabilityService.js';
import { findPublicRoom } from './roomsService.js';

// Date local de una fecha AAAA-MM-DD a una hora (24 pasa al día siguiente a las 00:00).
export function atHour(fecha, hour) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

// Datos públicos de una reserva a partir de su documento.
export function toItem(booking) {
  const { inicio, fin } = toSlot(booking, 'reserva');
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
    estado: booking.status,
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

// Crea una reserva CONFIRMED y bloquea cada hora, todo en una transacción.
export async function createBooking(uid, { roomId, fecha, inicio, fin }) {
  // Fuera de la transacción: 404 si la sala, su planta o su edificio no están publicados.
  const { room: publicRoom } = await findPublicRoom(roomId);
  assertBookable(publicRoom, inicio, fin);
  const horas = fin - inicio;
  let room;
  let importe;
  let codigo;
  try {
    let number;
    const id = await runTransaction(async (tx) => {
      // Se vuelven a leer la sala, su planta, su edificio y su empresa dentro de la transacción:
      // si se cambia el precio, se oculta, se despublica o se suspende la empresa mientras
      // tanto, la reserva usa los datos del momento del commit (404 si ya no son públicos).
      ({ room } = await findPublicRoom(roomId, { tx }));
      assertBookable(room, inicio, fin);
      importe = room.price * horas;
      await assertSlotAvailable(roomId, fecha, inicio, fin, tx);
      // Todas las lecturas van antes que las escrituras: el contador se lee aquí.
      const last = await counterModel.getValue('bookings', { tx });
      number = Math.max(last, FIRST_CODE_NUMBER - 1) + 1;
      codigo = `${CODE_PREFIX}${number}`;
      const bookingId = await bookingModel.create(
        {
          code: codigo,
          userId: uid,
          companyId: room.companyId,
          roomId,
          startDate: atHour(fecha, inicio),
          endDate: atHour(fecha, fin),
          price: room.price,
          pricePeriod: 'HOUR',
          totalAmount: importe,
          status: 'CONFIRMED',
          paymentId: null,
        },
        { tx },
      );
      await counterModel.setValue('bookings', number, { tx });
      for (let hour = inicio; hour < fin; hour++) {
        await occupancyModel.create(
          { companyId: room.companyId, roomId, date: fecha, hour, bookingId },
          { id: occupancyModel.slotId(roomId, fecha, hour), tx },
        );
      }
      return bookingId;
    });
    const estado = 'CONFIRMED';
    return {
      id,
      codigo,
      roomId,
      fecha,
      inicio,
      fin,
      horas,
      precioHora: room.price,
      importe,
      estado,
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
  const proximas = items.filter((i) => i.end > ahora).sort((a, b) => a.start - b.start);
  const pasadas = items.filter((i) => i.end <= ahora).sort((a, b) => b.start - a.start);
  return { proximas: proximas.map((i) => i.item), pasadas: pasadas.map((i) => i.item) };
}

// 404 NOT_FOUND si la reserva no existe o es de otro usuario (mismo error, para no revelarla).
function assertBookingOfUser(booking, uid) {
  if (!booking || booking.userId !== uid) {
    throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
  }
}

// Comprueba existencia, propietario, estado y que no haya empezado; lanza el error que toque.
function assertCancellable(booking, uid) {
  assertBookingOfUser(booking, uid);
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
}

// Cancela una reserva propia y libera sus horas de occupancy en una transacción.
export async function cancelBooking(uid, id) {
  await runTransaction(async (tx) => {
    const booking = await bookingModel.findById(id, { tx });
    assertCancellable(booking, uid);
    const fecha = todayString(toDate(booking.startDate));
    const { inicio, fin } = toSlot(booking, 'reserva');
    await bookingModel.update(
      id,
      { status: 'CANCELLED', cancelledAt: now(), cancelledBy: 'CLIENT' },
      { tx },
    );
    for (let hour = inicio; hour < fin; hour++) {
      await occupancyModel.remove(occupancyModel.slotId(booking.roomId, fecha, hour), { tx });
    }
  });
  return { id, estado: 'CANCELLED' };
}

// Detalle de una reserva propia: 404 si no existe o es de otro usuario.
export async function getMyBooking(uid, id) {
  const booking = await bookingModel.findById(id);
  assertBookingOfUser(booking, uid);
  return buildBookingDetail(booking);
}
