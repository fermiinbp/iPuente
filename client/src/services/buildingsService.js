// Llamadas públicas de edificios: listado y detalle con sus plantas.
import { get } from './apiClient.js';

export function getBuildings({ signal } = {}) {
  return get('/buildings', { signal });
}

// `fecha` (AAAA-MM-DD) es opcional: sin ella, la API usa hoy para contar las salas libres de cada planta.
export function getBuilding(id, { fecha, signal } = {}) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return get(`/buildings/${encodeURIComponent(id)}${query}`, { signal });
}
