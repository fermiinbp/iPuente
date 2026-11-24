// Edificios públicos: buscador de publicados con salas que encajan y detalle con sus plantas y salas libres en una fecha.
// Solo devuelve estados y datos del edificio; nunca quién ha reservado.
import { BOOKING_HOURS } from '../config/bookingHours.js';
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { isDeleted, notDeleted } from '../utils/softDelete.js';
import { matchesNeeds, parseEquipamiento } from '../utils/roomNeeds.js';
import { normalizeText } from '../utils/text.js';
import {
  effectivePrice,
  freeSlots,
  getDayItemsForRooms,
  isBookable,
  ROOM_STATUS,
  roomStatus,
} from './availabilityService.js';
import { filterPublicBuildings, isBuildingPublic } from './publicCatalogService.js';

const toPublic = (b) => ({
  id: b.id,
  nombre: b.name,
  descripcion: b.description ?? '',
  direccion: b.address,
  ciudad: b.city,
  codigoPostal: b.postalCode,
  pais: b.country,
  latitud: b.latitude ?? null,
  longitud: b.longitude ?? null,
  numPlantas: b.floorCount,
});

// Nº de salas de la planta libres en la fecha. Solo consulta reservas de las salas reservables.
async function countFreeRooms(floorId, fecha) {
  const rooms = (await roomModel.listByFloor(floorId)).filter(isBookable);
  const itemsById = await getDayItemsForRooms(
    rooms.map((r) => r.id),
    fecha,
  );
  const statuses = rooms.map((room) => roomStatus(room, itemsById.get(room.id)));
  return statuses.filter((s) => s === ROOM_STATUS.FREE).length;
}

const DEFAULT_LIMIT = 20;

// ¿La sala encaja con los filtros de sala (personas, tipo, precio y equipamiento)?
function matchesRoom(room, { personas, tipo, precioMax, equipamiento }) {
  if (tipo !== undefined && room.type !== tipo) return false;
  if (precioMax !== undefined && !(effectivePrice(room) <= precioMax)) return false;
  return matchesNeeds(room, { personas, equipamiento });
}

// Orden del listado: por precio (def.) o por nº de salas; desempata y acaba por nombre.
function compareBuildings(orden) {
  const byName = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  const byPrice = (a, b) => a.precioDesde - b.precioDesde;
  const bySalas = (a, b) => b.salasDisponibles - a.salasDisponibles;
  return orden === 'salas'
    ? (a, b) => bySalas(a, b) || byPrice(a, b) || byName(a, b)
    : (a, b) => byPrice(a, b) || bySalas(a, b) || byName(a, b);
}

// Edificios publicados con al menos una sala que encaje con los filtros, paginados.
// filtros: { ciudad, personas, equipamiento[], fecha, tipo, precioMax, orden, page, limit }.
export async function searchPublished(filtros = {}) {
  const { fecha, orden, page = 1, limit = DEFAULT_LIMIT } = filtros;
  const equipamiento = parseEquipamiento(filtros.equipamiento);
  const ciudad = normalizeText(filtros.ciudad);
  const [published, floors] = await Promise.all([
    buildingModel.listByStatus('PUBLISHED'),
    floorModel.listByStatus('PUBLISHED'),
  ]);
  // Primero la ciudad (en memoria) y luego la empresa aprobada, para leer menos empresas.
  const buildings = await filterPublicBuildings(
    published.filter((b) => normalizeText(b.city).includes(ciudad)),
  );
  const buildingsById = new Map(buildings.map((b) => [b.id, b]));
  const floorIds = new Set(
    floors.filter((f) => notDeleted(f) && buildingsById.has(f.buildingId)).map((f) => f.id),
  );
  const allRooms = await roomModel.listByBuildings([...buildingsById.keys()]);
  let rooms = allRooms.filter(
    (r) => floorIds.has(r.floorId) && isBookable(r) && matchesRoom(r, { ...filtros, equipamiento }),
  );
  if (fecha) {
    const itemsById = await getDayItemsForRooms(
      rooms.map((r) => r.id),
      fecha,
    );
    rooms = rooms.filter((r) => freeSlots(itemsById.get(r.id) ?? [], BOOKING_HOURS).length > 0);
  }
  const groups = new Map();
  for (const room of rooms) {
    const g = groups.get(room.buildingId) ?? { count: 0, min: Infinity };
    groups.set(room.buildingId, { count: g.count + 1, min: Math.min(g.min, effectivePrice(room)) });
  }
  const edificios = [...groups]
    .map(([id, g]) => {
      const b = buildingsById.get(id);
      return {
        ...toPublic(b),
        foto: b.photos?.[0] ?? null,
        salasDisponibles: g.count,
        precioDesde: g.min,
      };
    })
    .sort(compareBuildings(orden));
  const start = (page - 1) * limit;
  return { edificios: edificios.slice(start, start + limit), total: edificios.length, page, limit };
}

export async function getPublished(id, fecha = todayString()) {
  const building = await buildingModel.findById(id);
  if (!(await isBuildingPublic(building))) {
    throw new HttpError(404, 'NOT_FOUND', 'El edificio no existe');
  }
  const floors = (await floorModel.listByBuilding(id))
    .filter((f) => f.status === 'PUBLISHED' && !isDeleted(f))
    .sort((a, b) => a.level - b.level);
  const plantas = await Promise.all(
    floors.map(async (f) => ({
      id: f.id,
      nombre: f.name,
      nivel: f.level,
      salasLibres: await countFreeRooms(f.id, fecha),
    })),
  );
  return {
    ...toPublic(building),
    plantas,
    salasLibres: plantas.reduce((sum, p) => sum + p.salasLibres, 0),
  };
}
