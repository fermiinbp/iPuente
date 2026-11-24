// Lee, guarda el mapa de una planta, sincroniza la colección rooms (crea, conserva o desactiva salas) y publica.
import * as buildingModel from '../models/buildingModel.js';
import { runTransaction } from '../models/baseModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { HttpError } from '../utils/httpError.js';
import { isDeleted } from '../utils/softDelete.js';
import { countFutureBookings, futureBookingsNotice, joinNotices } from './futureBookingsService.js';
import { hasPrice } from './availabilityService.js';
import { getOwnedFloor } from './ownershipService.js';
import { assertCompanyCanCharge } from './payoutsService.js';

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
    isFree: false,
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
    return room && room.bookable === true && room.status !== 'INACTIVE' && hasPrice(room);
  });
}

// true si alguna sala del mapa es reservable, está activa, tiene precio y NO es gratis (necesita cobrar).
function hasPaidRoom(salas, roomsById) {
  return salas.some((s) => {
    const room = roomsById.get(s.id);
    return (
      room &&
      room.bookable === true &&
      room.status !== 'INACTIVE' &&
      hasPrice(room) &&
      room.isFree !== true
    );
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
// Una sala que vuelve al mapa estando INACTIVE se reactiva (solo saveMap escribe INACTIVE).
function planRooms(salas, roomsById) {
  const ids = new Set(salas.map((s) => s.id));
  const plan = { creates: [], updates: [], deactivations: [] };
  for (const sala of salas) {
    const room = roomsById.get(sala.id);
    if (!room) {
      plan.creates.push(sala);
      continue;
    }
    // Una sala eliminada lógicamente conserva su historial de reservas: su id no se reutiliza.
    if (isDeleted(room)) {
      throw new HttpError(
        409,
        'ROOM_ID_TAKEN',
        'Una sala con ese id fue eliminada y no se puede reutilizar',
      );
    }
    const data = {};
    if (room.name !== sala.nombre) data.name = sala.nombre;
    if (room.code !== sala.codigo) data.code = sala.codigo;
    if (room.type !== sala.tipo) data.type = sala.tipo;
    if (room.status === 'INACTIVE') data.status = 'ACTIVE';
    if (Object.keys(data).length > 0) plan.updates.push({ id: sala.id, data });
  }
  for (const room of roomsById.values()) {
    if (ids.has(room.id)) continue;
    if (room.status !== 'INACTIVE' || room.bookable !== false) plan.deactivations.push(room);
  }
  return plan;
}

// Escribe el plan en rooms. Las quitadas del mapa quedan INACTIVE y no reservables.
async function writePlan(floor, plan, tx) {
  for (const sala of plan.creates) {
    await roomModel.create(newRoomData(floor, sala), { id: sala.id, tx });
  }
  for (const { id, data } of plan.updates) {
    await roomModel.update(id, data, { tx });
  }
  for (const room of plan.deactivations) {
    await roomModel.update(room.id, { status: 'INACTIVE', bookable: false }, { tx });
  }
}

// Lee el mapa de una planta propia (borrador o publicada) para el editor. Las salas eliminadas
// lógicamente se excluyen (su id no se puede volver a guardar). Sin mapa: salas vacías y el resto null.
export async function getFloor(companyId, floorId) {
  const floor = await getOwnedFloor(floorId, companyId);
  const rooms = await roomModel.listByFloor(floorId);
  const deleted = new Set(rooms.filter(isDeleted).map((r) => r.id));
  const salas = Array.isArray(floor.salas) ? floor.salas.filter((s) => !deleted.has(s.id)) : [];
  const hasMap = Number.isFinite(floor.ancho) && Number.isFinite(floor.alto);
  return {
    id: floorId,
    buildingId: floor.buildingId,
    numero: floor.level,
    nombre: floor.name,
    publicado: floor.status === 'PUBLISHED',
    ancho: hasMap ? floor.ancho : null,
    alto: hasMap ? floor.alto : null,
    origen: hasMap ? (floor.origen ?? null) : null,
    salas: pickSalas(salas),
    mapImageUrl: floor.mapImageUrl ?? null,
  };
}

// Guarda el mapa de una planta propia y sincroniza sus salas en una transacción.
export async function saveMap(companyId, floorId, map) {
  await getOwnedFloor(floorId, companyId);
  const salas = pickSalas(map.salas);
  const { ancho, alto, origen } = map;

  return runTransaction(async (tx) => {
    // Todas las lecturas antes de las escrituras.
    const floor = await floorModel.findById(floorId, { tx });
    if (!floor || isDeleted(floor))
      throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
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
    await writePlan(floor, plan, tx);
    const update = { ancho, alto, origen, salas };
    if (map.mapImageUrl !== undefined) update.mapImageUrl = map.mapImageUrl;
    await floorModel.update(floorId, update, { tx });

    const publicado = floor.status === 'PUBLISHED';
    const result = { id: floorId, ancho, alto, origen, salas, publicado };
    result.mapImageUrl =
      update.mapImageUrl !== undefined ? update.mapImageUrl : (floor.mapImageUrl ?? null);
    result.salasCreadas = plan.creates.length;
    result.salasDesactivadas = plan.deactivations.filter((r) => r.status !== 'INACTIVE').length;
    // Planta publicada que tras guardar ya no cumple los requisitos: se avisa, no se despublica.
    if (publicado && !hasBookableRoom(salas, roomsById)) {
      result.aviso =
        'La planta sigue publicada pero ya no tiene ninguna sala reservable con precio';
    }
    return result;
  });
}

// Publica una planta propia si tiene mapa y al menos una sala reservable con precio. Si alguna de sus
// salas es de pago (no gratis), la cuenta de cobros de la empresa debe estar activa: Stripe se
// consulta ANTES de la transacción (409 PAYOUTS_REQUIRED; 503 si Stripe no responde). Solo salas
// gratis: no se exige. Publicar una planta que ya está publicada no cambia nada y no exige la cuenta
// (sigue siendo idempotente); lo que protege el cobro es createBooking/createCheckout, que la exigen
// siempre y también cubren una sala que pasa a ser de pago después de publicar.
export async function publishFloor(companyId, floorId) {
  await getOwnedFloor(floorId, companyId);
  const before = await runTransaction(async (tx) => {
    const floor = await floorModel.findById(floorId, { tx });
    if (!floor || isDeleted(floor)) return null;
    const rooms = await roomModel.listByFloor(floorId, { tx });
    const paid =
      Array.isArray(floor.salas) && hasPaidRoom(floor.salas, new Map(rooms.map((r) => [r.id, r])));
    return { paid, published: floor.status === 'PUBLISHED' };
  });
  let checked = false;
  if (before?.paid && !before.published) {
    await assertCompanyCanCharge(companyId, { forCompany: true });
    checked = true;
  }
  return runTransaction(async (tx) => {
    const floor = await floorModel.findById(floorId, { tx });
    if (!floor || isDeleted(floor))
      throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
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
    // Si las salas cambiaron a de pago mientras tanto y no se comprobó la cuenta, se reintenta.
    if (floor.status !== 'PUBLISHED' && !checked && hasPaidRoom(floor.salas, roomsById)) {
      throw new HttpError(409, 'BUSY', 'La planta ha cambiado; inténtalo de nuevo');
    }
    if (floor.status !== 'PUBLISHED') {
      await floorModel.update(floorId, { status: 'PUBLISHED' }, { tx });
    }
    return { id: floorId, publicado: true };
  });
}

// Vuelve una planta propia a borrador (idempotente). Si era la última publicada de un edificio
// publicado, el edificio sigue publicado y se avisa.
export async function unpublishFloor(companyId, floorId) {
  await getOwnedFloor(floorId, companyId);
  const { result, lastFloorNotice, roomIds } = await runTransaction(async (tx) => {
    const floor = await floorModel.findById(floorId, { tx });
    if (!floor || isDeleted(floor))
      throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
    const floors = await floorModel.listByBuilding(floor.buildingId, { tx });
    const building = await buildingModel.findById(floor.buildingId, { tx });
    const rooms = await roomModel.listByFloor(floorId, { tx });
    if (floor.status !== 'DRAFT') await floorModel.update(floorId, { status: 'DRAFT' }, { tx });
    const base = {
      id: floorId,
      buildingId: floor.buildingId,
      numero: floor.level,
      nombre: floor.name,
      publicado: false,
    };
    const othersPublished = floors.some((f) => f.id !== floorId && f.status === 'PUBLISHED');
    const notice =
      building?.status === 'PUBLISHED' && !othersPublished
        ? 'El edificio sigue publicado pero ya no tiene plantas publicadas'
        : undefined;
    return { result: base, lastFloorNotice: notice, roomIds: rooms.map((r) => r.id) };
  });
  result.reservasFuturas = await countFutureBookings(roomIds);
  const aviso = joinNotices(
    lastFloorNotice,
    futureBookingsNotice(result.reservasFuturas, 'esta planta'),
  );
  if (aviso) result.aviso = aviso;
  return result;
}
