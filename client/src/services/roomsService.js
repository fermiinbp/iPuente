// Ficha de sala y huecos libres.
import { get } from './apiClient.js';

export function getRoom(id, { signal } = {}) {
  return get(`/rooms/${encodeURIComponent(id)}`, { signal });
}

// Horas libres (enteras) de un día; `fecha` es AAAA-MM-DD y, sin ella, la API usa hoy.
export function getAvailability(id, { fecha, signal } = {}) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return get(`/rooms/${encodeURIComponent(id)}/availability${query}`, { signal });
}
