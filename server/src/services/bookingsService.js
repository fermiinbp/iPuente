// Crear, listar y cancelar reservas del cliente (sin pago online: nacen CONFIRMED). El servidor
// calcula pricePeriod y totalAmount a partir del price de la sala; occupancy bloquea cada hora.
import { now, runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import {
  BOOKING_HOURS,
  assertSlotAvailable,
  isBookable,
  toDate,
  toSlot,
} from './availabilityService.js';
import { findPublicRoom } from './roomsService.js';

// Date local de una fecha AAAA-MM-DD a una hora (24 pasa al día siguiente a las 00:00).
function atHour(fecha, hour) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

// Datos públicos de una reserva a partir de su documento.
function toItem(booking) {
  const { inicio, fin } = toSlot(booking, 'reserva');
  return {
    id: booking.id,
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

// Comprueba que la sala admite reservas y que la franja está dentro del horario.
function assertBookable(room, inicio, fin) {
  if (!isBookable(room) || typeof room.price !== 'number' || !(room.price > 0)) {
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

// Traduce el error de Firestore «el documento ya existe» a 409 SLOT_TAKEN.
function translateConflict(err) {
  const exists =
    err?.code === 6 || err?.code === 'already-exists' || /ALREADY_EXISTS/.test(err?.message ?? '');
  return exists ? new HttpError(409, 'SLOT_TAKEN', 'Esa franja ya está ocupada') : err;
}

// Crea una reserva CONFIRMED y bloquea cada hora, todo en una transacción.
export async function createBooking(uid, { roomId, fecha, inicio, fin }) {
  // Fuera de la transacción: 404 si la sala, su planta o su edificio no están publicados.
  const { room: publicRoom } = await findPublicRoom(roomId);
  assertBookable(publicRoom, inicio, fin);
  const horas = fin - inicio;
  let room;
  let importe;
  try {
    const id = await runTransaction(async (tx) => {
      // Se vuelve a leer la sala dentro de la transacción: si la empresa cambia el precio
      // o la oculta mientras tanto, la reserva usa los datos del momento del commit.
      room = await roomModel.findById(roomId, { tx });
      if (!room || room.status === 'INACTIVE') {
        throw new HttpError(404, 'NOT_FOUND', 'La sala no existe');
      }
      assertBookable(room, inicio, fin);
      importe = room.price * horas;
      await assertSlotAvailable(roomId, fecha, inicio, fin, tx);
      const bookingId = await bookingModel.create(
        {
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
      for (let hour = inicio; hour < fin; hour++) {
        await occupancyModel.create(
          { companyId: room.companyId, roomId, date: fecha, hour, bookingId },
          { id: occupancyModel.slotId(roomId, fecha, hour), tx },
        );
      }
      return bookingId;
    });
    const estado = 'CONFIRMED';
    return { id, roomId, fecha, inicio, fin, horas, precioHora: room.price, importe, estado };
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

// Comprueba existencia, propietario, estado y que no haya empezado; lanza el error que toque.
function assertCancellable(booking, uid) {
  if (!booking) throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
  if (booking.userId !== uid) {
    throw new HttpError(403, 'FORBIDDEN', 'No puedes cancelar una reserva de otro usuario');
  }
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
    await bookingModel.update(id, { status: 'CANCELLED', cancelledAt: now() }, { tx });
    for (let hour = inicio; hour < fin; hour++) {
      await occupancyModel.remove(occupancyModel.slotId(booking.roomId, fecha, hour), { tx });
    }
  });
  return { id, estado: 'CANCELLED' };
}
