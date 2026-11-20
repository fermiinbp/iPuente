// Eliminar un edificio, una planta o una sala propios. Con reservas futuras (CONFIRMED o
// PENDING_PAYMENT) se rechaza con 409 HAS_FUTURE_BOOKINGS y no se cancela nada. Sin ellas: lo que
// nunca tuvo reservas se borra del todo (en cascada) y lo que tiene historial se marca con
// deletedAt (borrado lógico), de modo que las reservas pasadas siguen mostrando su sala.
import { now, runTransaction } from '../models/baseModel.js';
import * as blockModel from '../models/blockModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { isDeleted, notDeleted } from '../utils/softDelete.js';
import { isBookable, toDate, toSlot } from './availabilityService.js';
import { slotIds } from './companyBookingsService.js';
import { isActiveFuture } from './futureBookingsService.js';
import { getOwnedBuilding, getOwnedFloor, getOwnedRoom } from './ownershipService.js';

// Tope de escrituras por operación (Firestore admite 500 por transacción).
const MAX_WRITES = 490;

const TEXTS = {
  room: { notFound: 'La sala no existe', what: 'la sala', where: 'esta sala' },
  floor: { notFound: 'La planta no existe', what: 'la planta', where: 'esta planta' },
  building: { notFound: 'El edificio no existe', what: 'el edificio', where: 'este edificio' },
};

// Lanza 404 si el documento no existe, está eliminado o es de otra empresa (dentro de la transacción).
function assertLive(doc, companyId, kind) {
  if (!doc || isDeleted(doc) || doc.companyId !== companyId) {
    throw new HttpError(404, 'NOT_FOUND', TEXTS[kind].notFound);
  }
  return doc;
}

// Comprueba que todo lo leído es de la empresa y que no hay más de MAX_WRITES documentos.
// Si algo es ajeno (datos inconsistentes) aborta con 409 sin tocar nada: es lo más seguro, porque
// filtrarlo dejaría documentos ajenos colgando de un recurso eliminado. El tope va antes de leer
// reservas y bloqueos para no cargar de más.
function assertScopeSafe(scope, companyId, kind) {
  const docs = [scope.floor, scope.building, ...scope.rooms, ...scope.floors].filter(Boolean);
  if (docs.some((d) => d.companyId !== companyId)) {
    throw new HttpError(
      409,
      'INCONSISTENT_DATA',
      `No se puede eliminar ${TEXTS[kind].what}: contiene datos de otra empresa`,
    );
  }
  if (scope.rooms.length + scope.floors.length + 1 > MAX_WRITES) throw tooMany(kind);
}

// 400 por demasiados elementos para una sola transacción.
function tooMany(kind) {
  return new HttpError(
    400,
    'TOO_MANY_CHANGES',
    `Hay demasiados elementos para eliminar ${TEXTS[kind].what} de una vez; elimina antes parte de su contenido`,
  );
}

// Lee, dentro de la transacción, lo que se va a eliminar: la sala, la planta o el edificio y sus
// salas (con tope de lectura). rooms incluye las ya eliminadas lógicamente (cuentan como
// historial); floors son las plantas implicadas y targetFloors las que se eliminan ahora.
async function loadScope(kind, id, companyId, tx) {
  const limit = MAX_WRITES + 1;
  let scope;
  if (kind === 'room') {
    const room = assertLive(await roomModel.findById(id, { tx }), companyId, 'room');
    const floor = await floorModel.findById(room.floorId, { tx });
    const siblings = floor ? await roomModel.listByFloor(floor.id, { tx, limit }) : [];
    scope = { room, floor, rooms: [room], floors: [], targetFloors: [], siblings };
  } else if (kind === 'floor') {
    const floor = assertLive(await floorModel.findById(id, { tx }), companyId, 'floor');
    const rooms = await roomModel.listByFloor(id, { tx, limit });
    const building = await buildingModel.findById(floor.buildingId, { tx });
    const buildingFloors = await floorModel.listByBuilding(floor.buildingId, { tx, limit });
    scope = { floor, building, buildingFloors, rooms, floors: [floor], targetFloors: [floor] };
  } else {
    const building = assertLive(await buildingModel.findById(id, { tx }), companyId, 'building');
    const floors = await floorModel.listByBuilding(id, { tx, limit });
    const rooms = await roomModel.listByBuilding(id, { tx, limit });
    scope = { building, rooms, floors, targetFloors: floors.filter(notDeleted) };
  }
  assertScopeSafe(scope, companyId, kind);
  return scope;
}

// Fichas de occupancy que pertenecen a los bloqueos dados (leídas en la transacción, en paralelo).
// Un bloqueo con fechas mal formadas se borra igualmente pero no se pueden deducir sus fichas.
async function readBlockSlots(blocks, tx) {
  const perBlock = await Promise.all(
    blocks.map(async (block) => {
      let ids;
      try {
        const fecha = todayString(toDate(block.startDate));
        const { inicio, fin } = toSlot(block, 'bloqueo');
        ids = slotIds(block.roomId, fecha, inicio, fin);
      } catch {
        return [];
      }
      const docs = await Promise.all(ids.map((slot) => occupancyModel.findById(slot, { tx })));
      return ids.filter((_slot, i) => docs[i]?.blockId === block.id);
    }),
  );
  return perBlock.flat();
}

// 409 si alguna reserva activa de las salas empieza en el futuro.
function assertNoFutureBookings(bookings, kind) {
  const reservasFuturas = bookings.filter((b) => isActiveFuture(b)).length;
  if (reservasFuturas === 0) return;
  const reservas =
    reservasFuturas === 1 ? '1 reserva futura' : `${reservasFuturas} reservas futuras`;
  const { what, where } = TEXTS[kind];
  throw new HttpError(
    409,
    'HAS_FUTURE_BOOKINGS',
    `No se puede eliminar ${what}: ${where} tiene ${reservas}. Cancélalas o espera a que terminen`,
    { reservasFuturas },
  );
}

// Decide qué se borra y qué se marca. Una sala tiene historial si tiene alguna reserva (en
// cualquier estado) o ya estaba eliminada lógicamente; una planta o un edificio, si lo tiene
// alguna de sus salas (o alguna de sus plantas eliminada lógicamente).
function plan(kind, scope, withHistory) {
  const hasHistory = (room) => isDeleted(room) || withHistory.has(room.id);
  const roomsOf = (floor) => scope.rooms.filter((r) => r.floorId === floor.id);
  const liveRooms = scope.rooms.filter(notDeleted);
  const result = {
    roomsRemove: liveRooms.filter((r) => !hasHistory(r)),
    roomsDeactivate: liveRooms.filter(hasHistory),
    floorsRemove: scope.targetFloors.filter((f) => !roomsOf(f).some(hasHistory)),
    floorsMark: scope.targetFloors.filter((f) => roomsOf(f).some(hasHistory)),
    buildingRemove: false,
    buildingMark: false,
  };
  if (kind === 'building') {
    const history = scope.rooms.some(hasHistory) || scope.floors.some(isDeleted);
    result.buildingRemove = !history;
    result.buildingMark = history;
  }
  return result;
}

// Aviso si lo eliminado deja una planta publicada sin salas reservables o un edificio publicado
// sin plantas publicadas (no bloquea).
function noticeFor(kind, scope, id) {
  if (kind === 'room' && scope.floor?.status === 'PUBLISHED') {
    const others = scope.siblings.filter((r) => r.id !== id);
    if (!others.some(isBookable)) {
      return 'La planta sigue publicada pero ya no tiene ninguna sala reservable con precio';
    }
  }
  if (kind === 'floor' && scope.building?.status === 'PUBLISHED') {
    const others = scope.buildingFloors.filter((f) => f.id !== id && notDeleted(f));
    if (!others.some((f) => f.status === 'PUBLISHED')) {
      return 'El edificio sigue publicado pero ya no tiene plantas publicadas';
    }
  }
  return undefined;
}

// Aplica el plan dentro de la transacción: salas, plantas, edificio, bloqueos y su occupancy.
async function applyPlan(kind, id, scope, p, blocks, slots, tx) {
  const marca = () => ({ status: 'DRAFT', deletedAt: now() });
  for (const r of p.roomsRemove) await roomModel.remove(r.id, { tx });
  for (const r of p.roomsDeactivate) {
    await roomModel.update(r.id, { status: 'INACTIVE', bookable: false, deletedAt: now() }, { tx });
  }
  for (const f of p.floorsRemove) await floorModel.remove(f.id, { tx });
  for (const f of p.floorsMark) await floorModel.update(f.id, marca(), { tx });
  if (p.buildingRemove) await buildingModel.remove(id, { tx });
  if (p.buildingMark) await buildingModel.update(id, marca(), { tx });
  for (const b of blocks) await blockModel.remove(b.id, { tx });
  for (const slot of slots) await occupancyModel.remove(slot, { tx });
  if (kind === 'room' && scope.floor) {
    // Se escribe siempre en la planta (aunque la sala no estuviera en su mapa) para que un
    // guardado de mapa simultáneo choque con esta transacción.
    const salas = (scope.floor.salas ?? []).filter((s) => s.id !== id);
    await floorModel.update(scope.floor.id, { salas }, { tx });
  }
}

// Número máximo de escrituras que hará el plan.
function countWrites(kind, scope, p, blocks, slots) {
  const mapa = kind === 'room' && scope.floor ? 1 : 0;
  return (
    p.roomsRemove.length +
    p.roomsDeactivate.length +
    p.floorsRemove.length +
    p.floorsMark.length +
    Number(p.buildingRemove || p.buildingMark) +
    blocks.length +
    slots.length +
    mapa
  );
}

// ¿Se ha eliminado de forma lógica el recurso pedido (y no solo algo de lo que cuelga de él)?
function isLogical(kind, p) {
  if (kind === 'room') return p.roomsDeactivate.length > 0;
  if (kind === 'floor') return p.floorsMark.length > 0;
  return p.buildingMark;
}

// Elimina el recurso en una sola transacción: lee todo, comprueba otra vez las reservas futuras
// (una reserva simultánea no se cuela) y escribe. kind: 'room' | 'floor' | 'building'.
async function removeResource(kind, companyId, id) {
  return runTransaction(async (tx) => {
    const scope = await loadScope(kind, id, companyId, tx);
    const live = scope.rooms.filter(notDeleted);
    const liveIds = live.map((r) => r.id);
    // Solo reservas futuras (consulta por fecha) y, por sala, si tiene alguna reserva (1 documento).
    const future = await bookingModel.listByRooms(liveIds, { from: new Date(), tx });
    assertNoFutureBookings(future, kind);
    const blocks = await blockModel.listByRooms(liveIds, { tx, limit: MAX_WRITES + 1 });
    if (blocks.length > MAX_WRITES) throw tooMany(kind);
    const [history, slots] = await Promise.all([
      Promise.all(live.map((r) => bookingModel.hasAnyForRoom(r.id, { tx }))),
      readBlockSlots(blocks, tx),
    ]);

    const withHistory = new Set(live.filter((_r, i) => history[i]).map((r) => r.id));
    const p = plan(kind, scope, withHistory);
    if (countWrites(kind, scope, p, blocks, slots) > MAX_WRITES) throw tooMany(kind);
    await applyPlan(kind, id, scope, p, blocks, slots, tx);

    const aviso = noticeFor(kind, scope, id);
    return {
      id,
      eliminado: true,
      borradoLogico: isLogical(kind, p),
      plantasEliminadas: p.floorsRemove.length + p.floorsMark.length,
      salasEliminadas: p.roomsRemove.length,
      salasDesactivadas: p.roomsDeactivate.length,
      bloqueosEliminados: blocks.length,
      ...(aviso && { aviso }),
    };
  });
}

// Elimina una sala propia (404/403 si no existe, está eliminada o es ajena).
export async function deleteRoom(companyId, id) {
  await getOwnedRoom(id, companyId);
  return removeResource('room', companyId, id);
}

// Elimina una planta propia con sus salas.
export async function deleteFloor(companyId, id) {
  await getOwnedFloor(id, companyId);
  return removeResource('floor', companyId, id);
}

// Elimina un edificio propio con sus plantas y salas.
export async function deleteBuilding(companyId, id) {
  await getOwnedBuilding(id, companyId);
  return removeResource('building', companyId, id);
}
