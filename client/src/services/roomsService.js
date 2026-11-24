// Ficha de sala y huecos libres.
import { get } from './apiClient.js';
import { getBuilding, getBuildings } from './buildingsService.js';
import { getFloor } from './floorsService.js';

export function getRoom(id, { signal } = {}) {
  return get(`/rooms/${encodeURIComponent(id)}`, { signal });
}

// Horas libres (enteras) de un día; `fecha` es AAAA-MM-DD y, sin ella, la API usa hoy.
export function getAvailability(id, { fecha, signal } = {}) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return get(`/rooms/${encodeURIComponent(id)}/availability${query}`, { signal });
}

// Salas destacadas de la home: las salas y boxes reservables (con precio o gratis) de los primeros
// edificios publicados, libres hoy primero y después por capacidad. Lee el buscador, el detalle de
// cada edificio y el plano de cada planta; para en cuanto junta `limit` salas.
// Devuelve [{ id, nombre, tipo, edificio, ciudad, capacidad, precioHora, gratis, estado }].
export async function getFeaturedRooms({ limit = 8, signal } = {}) {
  const { edificios = [] } = await getBuildings({ limit: 3, signal });
  const salas = [];
  for (const edificio of edificios) {
    const detalle = await getBuilding(edificio.id, { signal });
    const plantas = await Promise.all(
      (detalle.plantas ?? []).map((planta) => getFloor(planta.id, { signal })),
    );
    plantas
      .flatMap((planta) => planta.salas ?? [])
      .filter((sala) => ['sala', 'box'].includes(sala.tipo))
      .filter((sala) => sala.gratis || sala.precioHora > 0)
      .forEach((sala) =>
        salas.push({
          id: sala.id,
          nombre: sala.nombre,
          tipo: sala.tipo,
          edificio: detalle.nombre ?? edificio.nombre,
          ciudad: detalle.ciudad ?? edificio.ciudad,
          capacidad: sala.capacidad,
          precioHora: sala.precioHora,
          gratis: sala.gratis,
          estado: sala.estado,
        }),
      );
    if (salas.length >= limit) break;
  }
  const libreAntes = (sala) => (sala.estado === 'FREE' ? 0 : 1);
  return salas
    .sort((a, b) => libreAntes(a) - libreAntes(b) || (b.capacidad ?? 0) - (a.capacidad ?? 0))
    .slice(0, limit);
}
