// Llamada pública del mapa de una planta con el estado de cada sala en una fecha.
import { get } from './apiClient.js';

// `fecha` (AAAA-MM-DD) es opcional: sin ella, la API usa hoy.
export function getFloor(id, { fecha, signal } = {}) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return get(`/floors/${encodeURIComponent(id)}${query}`, { signal });
}
