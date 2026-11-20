// Salas públicas: ficha y horas libres de un día. Solo devuelve datos de la sala y horas;
// nunca quién ha reservado ni datos internos de la empresa.
import { BOOKING_HOURS } from '../config/bookingHours.js';
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { isDeleted } from '../utils/softDelete.js';
import { freeSlots, getDayItems, isBookable } from './availabilityService.js';
import { isBuildingPublic } from './publicCatalogService.js';

// Devuelve { room, floor, building } si la sala es pública (su empresa debe estar aprobada); si
// no, lanza 404. Con { tx } lee todo dentro de una transacción.
export async function findPublicRoom(id, { tx } = {}) {
  const notFound = () => new HttpError(404, 'NOT_FOUND', 'La sala no existe');
  const room = await roomModel.findById(id, { tx });
  if (!room || room.status === 'INACTIVE' || isDeleted(room)) throw notFound();
  const floor = await floorModel.findById(room.floorId, { tx });
  if (!floor || floor.status !== 'PUBLISHED' || isDeleted(floor)) throw notFound();
  const building = await buildingModel.findById(floor.buildingId, { tx });
  if (!(await isBuildingPublic(building, { tx }))) throw notFound();
  return { room, floor, building };
}

// Ficha y disponibilidad públicas: una sala no reservable (oculta o sin precio) no tiene
// ficha, para no mostrar sus datos comerciales. Las reservas usan findPublicRoom y siguen
// respondiendo 400 ROOM_NOT_BOOKABLE.
async function findBookablePublicRoom(id) {
  const found = await findPublicRoom(id);
  if (!isBookable(found.room)) throw new HttpError(404, 'NOT_FOUND', 'La sala no existe');
  return found;
}

export async function getPublicRoom(id) {
  const { room, floor, building } = await findBookablePublicRoom(id);
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
    reservable: true,
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
  const { room } = await findBookablePublicRoom(id);
  const horasLibres = freeSlots(await getDayItems(room.id, fecha), BOOKING_HOURS);
  return {
    roomId: room.id,
    fecha,
    desde: BOOKING_HOURS.desde,
    hasta: BOOKING_HOURS.hasta,
    horasLibres,
  };
}
