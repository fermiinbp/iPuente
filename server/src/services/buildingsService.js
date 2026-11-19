// Edificios públicos: listado de publicados y detalle con sus plantas y salas libres en una fecha.
// Solo devuelve estados y datos del edificio; nunca quién ha reservado.
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { getDayItems, isBookable, ROOM_STATUS, roomStatus } from './availabilityService.js';

const toPublic = (b) => ({
  id: b.id,
  nombre: b.name,
  descripcion: b.description ?? '',
  direccion: b.address,
  ciudad: b.city,
  codigoPostal: b.postalCode,
  pais: b.country,
  latitud: b.latitude,
  longitud: b.longitude,
  numPlantas: b.floorCount,
});

// Nº de salas de la planta libres en la fecha. Solo consulta reservas de las salas reservables.
async function countFreeRooms(floorId, fecha) {
  const rooms = (await roomModel.listByFloor(floorId)).filter(isBookable);
  const statuses = await Promise.all(
    rooms.map(async (room) => roomStatus(room, await getDayItems(room.id, fecha))),
  );
  return statuses.filter((s) => s === ROOM_STATUS.FREE).length;
}

export async function listPublished() {
  const buildings = await buildingModel.listByStatus('PUBLISHED');
  return buildings.map(toPublic);
}

export async function getPublished(id, fecha = todayString()) {
  const building = await buildingModel.findById(id);
  if (!building || building.status !== 'PUBLISHED') {
    throw new HttpError(404, 'NOT_FOUND', 'El edificio no existe');
  }
  const floors = (await floorModel.listByBuilding(id))
    .filter((f) => f.status === 'PUBLISHED')
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
