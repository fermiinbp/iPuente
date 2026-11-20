// Mapa público de una planta: sus salas con el estado (libre, ocupada, no disponible) de una fecha.
// Con hora, el estado es el de esa hora; sin ella, el del día completo. Nunca quién ha reservado.
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import {
  getDayItemsForRooms,
  isBookable,
  ROOM_STATUS,
  roomStatus,
  roomStatusAtHour,
} from './availabilityService.js';
import { isBuildingPublic } from './publicCatalogService.js';

export async function getPublishedMap(id, fecha = todayString(), hora) {
  const notFound = () => new HttpError(404, 'NOT_FOUND', 'La planta no existe');
  const floor = await floorModel.findById(id);
  if (!floor || floor.status !== 'PUBLISHED') throw notFound();
  const building = await buildingModel.findById(floor.buildingId);
  if (!(await isBuildingPublic(building))) throw notFound();

  const rooms = await roomModel.listByFloor(id);
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const itemsById = await getDayItemsForRooms(
    rooms.filter(isBookable).map((r) => r.id),
    fecha,
  );

  const statusOf = (room, items) =>
    hora === undefined ? roomStatus(room, items) : roomStatusAtHour(room, items, hora);

  const salas = (floor.salas ?? []).map((s) => {
    const room = roomsById.get(s.id);
    // Precio y capacidad solo de las salas reservables: las ocultas o sin precio no se exponen.
    const visible = isBookable(room);
    return {
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      tipo: s.tipo,
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.h,
      estado: room ? statusOf(room, itemsById.get(room.id) ?? []) : ROOM_STATUS.UNAVAILABLE,
      capacidad: visible ? (room.capacity ?? null) : null,
      precioHora: visible ? room.price : null,
    };
  });

  return {
    id: floor.id,
    nombre: floor.name,
    nivel: floor.level,
    edificioId: floor.buildingId,
    fecha,
    ...(hora !== undefined && { hora }),
    ancho: floor.ancho,
    alto: floor.alto,
    salas,
  };
}
