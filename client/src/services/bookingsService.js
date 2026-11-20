// Reservas del cliente: crear, listar y cancelar.
import { get, patch, post } from './apiClient.js';

// `inicio` y `fin` son horas enteras (10 → 11 = una hora). El importe lo calcula la API.
export function createBooking({ roomId, fecha, inicio, fin }) {
  return post('/bookings', { roomId, fecha, inicio, fin });
}

// Detalle de una reserva propia (sala, planta, edificio y, si está cancelada, motivo y quién). 404 si es ajena.
export function getBooking(id, { signal } = {}) {
  return get(`/bookings/${encodeURIComponent(id)}`, { signal });
}

export function getMyBookings({ signal } = {}) {
  return get('/bookings/me', { signal });
}

export function cancelBooking(id) {
  return patch(`/bookings/${encodeURIComponent(id)}/cancel`);
}
