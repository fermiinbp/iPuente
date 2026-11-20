// Llamadas públicas de edificios: listado con filtros y detalle con sus plantas.
import { get } from './apiClient.js';

// Listado de edificios publicados con al menos una sala que encaje. La API devuelve
// { edificios, total, page, limit }. Filtros opcionales: ciudad, personas, fecha (AAAA-MM-DD),
// tipo ('sala' | 'box'), precioMax, orden ('precio' | 'salas'), page y limit. Los vacíos no se envían.
export function getBuildings({ signal, ...filtros } = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return get(`/buildings${query ? `?${query}` : ''}`, { signal });
}

// `fecha` (AAAA-MM-DD) es opcional: sin ella, la API usa hoy para contar las salas libres de cada planta.
export function getBuilding(id, { fecha, signal } = {}) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return get(`/buildings/${encodeURIComponent(id)}${query}`, { signal });
}
