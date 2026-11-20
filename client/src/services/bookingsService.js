// Reservas del cliente: crear, listar y cancelar.
import { get, patch, post } from './apiClient.js';

// `inicio` y `fin` son horas enteras (10 → 11 = una hora). El importe lo calcula la API.
export function createBooking({ roomId, fecha, inicio, fin }) {
  return post('/bookings', { roomId, fecha, inicio, fin });
}

export function getMyBookings({ signal } = {}) {
  return get('/bookings/me', { signal });
}

export function cancelBooking(id) {
  return patch(`/bookings/${encodeURIComponent(id)}/cancel`);
}
