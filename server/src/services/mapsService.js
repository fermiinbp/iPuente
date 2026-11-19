// Guarda el mapa de una planta, sincroniza la colección rooms (crea, conserva o desactiva salas) y publica.
import { runTransaction } from '../models/baseModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { HttpError } from '../utils/httpError.js';
import { getOwnedFloor } from './ownershipService.js';

// Datos de una sala nueva: sin datos comerciales y oculta hasta que la empresa le ponga precio.
function newRoomData(floor, sala) {
  return {
    companyId: floor.companyId,
    buildingId: floor.buildingId,
    floorId: floor.id,
    name: sala.nombre,
    code: sala.codigo,
    type: sala.tipo,
    description: '',
    surface: null,
    capacity: null,
    price: null,
    pricePeriod: 'HOUR',
    amenities: [],
    photos: [],
    bookable: false,
    status: 'ACTIVE',
    openingHours: null,
  };
}

// Salas del mapa con solo los campos permitidos.
function pickSalas(salas) {
  return salas.map(({ id, codigo, nombre, tipo, x, y, w, h }) => ({
    id,
    codigo,
    nombre,
    tipo,
    x,
    y,
    w,
    h,
  }));
}

// true si alguna sala del mapa es reservable, está activa y tiene precio.
function hasBookableRoom(salas, roomsById) {
  return salas.some((s) => {
    const room = roomsById.get(s.id);
    return room && room.bookable === true && room.status !== 'INACTIVE' && room.price > 0;
  });
}

// Tope de escrituras por guardado (Firestore admite 500 por transacción).
const MAX_WRITES = 490;

// Lee las rooms de la planta y comprueba que los ids nuevos no pertenezcan a otra planta.
async function readRooms(floor, salas, tx) {
  const rooms = await roomModel.listByFloor(floor.id, { tx });
  if (rooms.some((r) => r.companyId !== floor.companyId)) {
    throw new HttpError(409, 'ROOM_ID_TAKEN', 'Algún id de sala ya está en uso en otra empresa');
  }
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const fresh = salas.filter((s) => !byId.has(s.id));
  const taken = await Promise.all(fresh.map((s) => roomModel.findById(s.id, { tx })));
  if (taken.some(Boolean)) {
    throw new HttpError(409, 'ROOM_ID_TAKEN', 'Algún id de sala ya está en uso en otra planta');
  }
  return byId;
}

// Calcula los cambios en rooms: salas a crear, a actualizar (solo si cambian) y a desactivar.
function planRooms(salas, roomsById) {
  const ids = new Set(salas.map((s) => s.id));
  const plan = { creates: [], updates: [], deactivations: [] };
  for (const sala of salas) {
    const room = roomsById.get(sala.id);
    if (!room) plan.creates.push(sala);
    else if (room.name !== sala.nombre || room.code !== sala.codigo || room.type !== sala.tipo) {
      plan.updates.push(sala);
    }
  }
  for (const room of roomsById.values()) {
    if (!ids.has(room.id) && room.bookable === true) plan.deactivations.push(room);
  }
  return plan;
}

// Escribe el plan en rooms. No toca el status de las existentes (una INACTIVE no se reactiva).
function writePlan(floor, plan, tx) {
  for (const sala of plan.creates) {
    roomModel.create(newRoomData(floor, sala), { id: sala.id, tx });
  }
  for (const sala of plan.updates) {
    const data = { name: sala.nombre, code: sala.codigo, type: sala.tipo };
    roomModel.update(sala.id, data, { tx });
  }
  for (const room of plan.deactivations) {
    roomModel.update(room.id, { bookable: false }, { tx });
  }
}

// Guarda el mapa de una planta propia y sincroniza sus salas en una transacción.
export async function saveMap(companyId, floorId, map) {
  await getOwnedFloor(floorId, companyId);
  const salas = pickSalas(map.salas);
  const { ancho, alto, origen } = map;

  return runTransaction(async (tx) => {
    // Todas las lecturas antes de las escrituras.
    const floor = await floorModel.findById(floorId, { tx });
    if (!floor) throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
    const roomsById = await readRooms(floor, salas, tx);

    const plan = planRooms(salas, roomsById);
    const writes = plan.creates.length + plan.updates.length + plan.deactivations.length + 1;
    if (writes > MAX_WRITES) {
      throw new HttpError(
        400,
        'TOO_MANY_CHANGES',
        'Demasiados cambios en un solo guardado; divide el mapa o guarda en varios pasos',
      );
    }
    writePlan(floor, plan, tx);
    floorModel.update(floorId, { ancho, alto, origen, salas }, { tx });

    const publicado = floor.status === 'PUBLISHED';
    const result = { id: floorId, ancho, alto, origen, salas, publicado };
    result.salasCreadas = plan.creates.length;
    result.salasDesactivadas = plan.deactivations.length;
    // Planta publicada que tras guardar ya no cumple los requisitos: se avisa, no se despublica.
    if (publicado && !hasBookableRoom(salas, roomsById)) {
      result.aviso =
        'La planta sigue publicada pero ya no tiene ninguna sala reservable con precio';
    }
    return result;
  });
}

// Publica una planta propia si tiene mapa y al menos una sala reservable con precio.
export async function publishFloor(companyId, floorId) {
  await getOwnedFloor(floorId, companyId);
  return runTransaction(async (tx) => {
    const floor = await floorModel.findById(floorId, { tx });
    if (!floor) throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
    if (!Array.isArray(floor.salas) || floor.salas.length === 0) {
      throw new HttpError(400, 'MAP_REQUIRED', 'La planta no tiene mapa');
    }
    const rooms = await roomModel.listByFloor(floorId, { tx });
    const roomsById = new Map(rooms.map((r) => [r.id, r]));
    if (!hasBookableRoom(floor.salas, roomsById)) {
      throw new HttpError(
        400,
        'NO_BOOKABLE_ROOMS',
        'Necesitas al menos una sala reservable con precio',
      );
    }
    if (floor.status !== 'PUBLISHED') floorModel.update(floorId, { status: 'PUBLISHED' }, { tx });
    return { id: floorId, publicado: true };
  });
}
