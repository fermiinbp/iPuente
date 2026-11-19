// Salas públicas: ficha y horas libres de un día. Solo devuelve datos de la sala y horas;
// nunca quién ha reservado ni datos internos de la empresa.
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { BOOKING_HOURS, freeSlots, getDayItems, isBookable } from './availabilityService.js';

// Devuelve { room, floor, building } si la sala es pública; si no, lanza 404.
export async function findPublicRoom(id) {
  const notFound = () => new HttpError(404, 'NOT_FOUND', 'La sala no existe');
  const room = await roomModel.findById(id);
  if (!room || room.status === 'INACTIVE') throw notFound();
  const floor = await floorModel.findById(room.floorId);
  if (!floor || floor.status !== 'PUBLISHED') throw notFound();
  const building = await buildingModel.findById(floor.buildingId);
  if (!building || building.status !== 'PUBLISHED') throw notFound();
  return { room, floor, building };
}

export async function getPublicRoom(id) {
  const { room, floor, building } = await findPublicRoom(id);
  return {
    id: room.id,
    codigo: room.code,
    nombre: room.name,
    tipo: room.type,
    descripcion: room.description ?? '',
    capacidad: room.capacity,
    m2: room.surface,
    precioHora: room.price,
    periodoPrecio: room.pricePeriod,
    equipamiento: room.amenities ?? [],
    fotos: room.photos ?? [],
    reservable: isBookable(room),
    edificio: {
      id: building.id,
      nombre: building.name,
      direccion: building.address,
      ciudad: building.city,
    },
    planta: { id: floor.id, nombre: floor.name, nivel: floor.level },
  };
}

export async function getAvailability(id, fecha = todayString()) {
  const { room } = await findPublicRoom(id);
  const horasLibres = isBookable(room)
    ? freeSlots(await getDayItems(room.id, fecha), BOOKING_HOURS)
    : [];
  return {
    roomId: room.id,
    fecha,
    desde: BOOKING_HOURS.desde,
    hasta: BOOKING_HOURS.hasta,
    horasLibres,
  };
}
