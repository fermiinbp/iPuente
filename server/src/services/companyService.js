// Reglas de empresas: estado (PENDING, APPROVED, REJECTED, SUSPENDED) y su nombre en español, y consulta de la empresa propia.
import * as buildingModel from '../models/buildingModel.js';
import * as companyModel from '../models/companyModel.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as companyTaxIdModel from '../models/companyTaxIdModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { HttpError } from '../utils/httpError.js';
import { notDeleted } from '../utils/softDelete.js';
import { hasPrice } from './availabilityService.js';
import { countFutureBookings, futureBookingsNotice } from './futureBookingsService.js';
import { isOrphanTaxId } from './authService.js';
import { assertOwnedBy, getOwnedBuilding, getOwnedFloor } from './ownershipService.js';

export const COMPANY_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

const STATUS_ES = {
  [COMPANY_STATUS.PENDING]: 'pendiente',
  [COMPANY_STATUS.APPROVED]: 'aprobada',
  [COMPANY_STATUS.REJECTED]: 'rechazada',
  [COMPANY_STATUS.SUSPENDED]: 'suspendida',
};

// Estado de una empresa en Firestore. Si es antigua y no tiene status, se deriva de verified.
export function companyStatus(company) {
  if (COMPANY_STATUS[company?.status]) return company.status;
  return company?.verified === true ? COMPANY_STATUS.APPROVED : COMPANY_STATUS.PENDING;
}

// Motivo vigente: de rechazo o de suspensión según el estado; null si no hay.
export function companyMotivo(company) {
  const status = companyStatus(company);
  if (status === COMPANY_STATUS.REJECTED) return company.rejectionReason ?? null;
  if (status === COMPANY_STATUS.SUSPENDED) return company.suspensionReason ?? null;
  return null;
}

// Estado en español de una empresa. Si es antigua y no tiene status, se deriva de verified.
export function companyEstado(company) {
  return STATUS_ES[companyStatus(company)];
}

// Convierte un timestamp de Firestore (o fecha) a ISO; si no hay, undefined.
export function toIso(value) {
  if (!value) return undefined;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Respuesta en español de un edificio.
function buildingView(b) {
  return {
    id: b.id,
    nombre: b.name,
    direccion: b.address,
    ciudad: b.city,
    descripcion: b.description ?? '',
    fotos: b.photos ?? [],
    latitud: b.latitude ?? null,
    longitud: b.longitude ?? null,
    publicado: b.status === 'PUBLISHED',
  };
}

// Respuesta en español de una planta.
function floorView(f) {
  return {
    id: f.id,
    buildingId: f.buildingId,
    numero: f.level,
    nombre: f.name,
    publicado: f.status === 'PUBLISHED',
    mapImageUrl: f.mapImageUrl ?? null,
  };
}

// Respuesta en español de una sala.
function roomView(r) {
  return {
    id: r.id,
    floorId: r.floorId,
    buildingId: r.buildingId,
    codigo: r.code,
    nombre: r.name,
    capacidad: r.capacity ?? null,
    m2: r.surface ?? null,
    precioHora: r.isFree === true ? null : (r.price ?? null),
    gratis: r.isFree === true,
    equipamiento: r.amenities ?? [],
    reservable: r.bookable === true,
    fotos: r.photos ?? [],
  };
}

// Copia solo los campos permitidos (clave del body -> campo de Firestore) que vengan informados.
function pick(body, map) {
  const data = {};
  for (const [key, field] of Object.entries(map)) {
    if (body?.[key] !== undefined) data[field] = body[key];
  }
  return data;
}

const BUILDING_MAP = {
  nombre: 'name',
  direccion: 'address',
  ciudad: 'city',
  descripcion: 'description',
  fotos: 'photos',
  latitud: 'latitude',
  longitud: 'longitude',
};

// Campos de un edificio para Firestore. Las coordenadas -0 se guardan como 0.
function buildingData(body) {
  const data = pick(body, BUILDING_MAP);
  for (const field of ['latitude', 'longitude']) {
    if (data[field] === 0) data[field] = 0;
  }
  return data;
}

const FLOOR_MAP = { numero: 'level', nombre: 'name' };
const ROOM_MAP = {
  nombre: 'name',
  capacidad: 'capacity',
  m2: 'surface',
  precioHora: 'price',
  equipamiento: 'amenities',
  reservable: 'bookable',
  fotos: 'photos',
};

// Lanza 409 si otra planta del edificio ya tiene ese número (una eliminada no ocupa su número).
// Se lee dentro de la transacción recibida para evitar carreras.
async function assertLevelFree(buildingId, level, exceptFloorId, tx) {
  const floors = await floorModel.listByBuilding(buildingId, { tx });
  if (floors.some((f) => notDeleted(f) && f.level === level && f.id !== exceptFloorId)) {
    throw new HttpError(409, 'FLOOR_EXISTS', 'Ya existe una planta con ese número en el edificio');
  }
}

// Estado calculado de una sala: sin_precio, publicada (reservable) u oculta.
export function roomEstado(room) {
  if (!hasPrice(room)) return 'sin_precio';
  return room.bookable === true ? 'publicada' : 'oculta';
}

// Lanza 400 si la sala quedaría reservable sin un precio mayor que 0.
function assertPriceIfBookable(room) {
  if (room.bookable === true && roomEstado(room) === 'sin_precio') {
    throw new HttpError(400, 'ROOM_WITHOUT_PRICE', 'Pon un precio a la sala antes de mostrarla');
  }
}

// Sala con su estado calculado.
function roomWithEstado(room) {
  return { ...roomView(room), estado: roomEstado(room) };
}

// Edificios de la empresa, cada uno con sus plantas (ordenadas por número) y nº de salas activas.
export async function listBuildings(companyId) {
  const [allBuildings, allFloors, allRooms] = await Promise.all([
    buildingModel.listByCompany(companyId),
    floorModel.listByCompany(companyId),
    roomModel.listByCompany(companyId),
  ]);
  const buildings = allBuildings.filter(notDeleted);
  const floors = allFloors.filter(notDeleted);
  const rooms = allRooms.filter(notDeleted);
  const roomCount = new Map();
  for (const r of rooms) {
    if (r.status === 'ACTIVE') roomCount.set(r.floorId, (roomCount.get(r.floorId) ?? 0) + 1);
  }
  const byBuilding = new Map();
  for (const f of floors) {
    const item = {
      id: f.id,
      numero: f.level,
      nombre: f.name,
      publicado: f.status === 'PUBLISHED',
      salas: roomCount.get(f.id) ?? 0,
    };
    byBuilding.set(f.buildingId, [...(byBuilding.get(f.buildingId) ?? []), item]);
  }
  return buildings.map((b) => ({
    ...buildingView(b),
    plantas: (byBuilding.get(b.id) ?? []).sort((a, c) => a.numero - c.numero),
  }));
}

// Publica un edificio propio si tiene al menos una planta publicada (idempotente). El edificio
// se lee y comprueba dentro de la transacción: si se elimina a la vez, da 404.
export async function publishBuilding(companyId, id) {
  const building = await runTransaction(async (tx) => {
    const current = assertOwnedBy(await buildingModel.findById(id, { tx }), companyId);
    const floors = await floorModel.listByBuilding(id, { tx });
    if (
      !floors.some((f) => notDeleted(f) && f.companyId === companyId && f.status === 'PUBLISHED')
    ) {
      throw new HttpError(
        400,
        'NO_PUBLISHED_FLOORS',
        'Publica al menos una planta antes de publicar el edificio',
      );
    }
    if (current.status !== 'PUBLISHED') {
      await buildingModel.update(id, { status: 'PUBLISHED' }, { tx });
    }
    return current;
  });
  return buildingView({ ...building, status: 'PUBLISHED' });
}

// Vuelve un edificio propio a borrador (idempotente). Avisa de las reservas futuras, sin bloquear.
export async function unpublishBuilding(companyId, id) {
  const building = await runTransaction(async (tx) => {
    const current = assertOwnedBy(await buildingModel.findById(id, { tx }), companyId);
    if (current.status !== 'DRAFT') await buildingModel.update(id, { status: 'DRAFT' }, { tx });
    return current;
  });
  const rooms = await roomModel.listByBuilding(id);
  const reservasFuturas = await countFutureBookings(rooms.filter(notDeleted).map((r) => r.id));
  const aviso = futureBookingsNotice(reservasFuturas, 'este edificio');
  return {
    ...buildingView({ ...building, status: 'DRAFT' }),
    reservasFuturas,
    ...(aviso && { aviso }),
  };
}

// Salas activas de la empresa con su estado, filtradas por edificio, planta y estado.
// Orden: nombre del edificio, número de planta y código.
export async function listRooms(companyId, { buildingId, floorId, estado } = {}) {
  if (buildingId) await getOwnedBuilding(buildingId, companyId);
  if (floorId) await getOwnedFloor(floorId, companyId);
  const [allBuildings, allFloors, allRooms] = await Promise.all([
    buildingModel.listByCompany(companyId),
    floorModel.listByCompany(companyId),
    roomModel.listByCompany(companyId),
  ]);
  const buildings = allBuildings.filter(notDeleted);
  const floors = allFloors.filter(notDeleted);
  const rooms = allRooms.filter(notDeleted);
  const buildingName = new Map(buildings.map((b) => [b.id, b.name ?? '']));
  const level = new Map(floors.map((f) => [f.id, f.level ?? 0]));
  return rooms
    .filter((r) => r.status === 'ACTIVE')
    .filter((r) => !buildingId || r.buildingId === buildingId)
    .filter((r) => !floorId || r.floorId === floorId)
    .map(roomWithEstado)
    .filter((r) => !estado || r.estado === estado)
    .sort(
      (a, b) =>
        (buildingName.get(a.buildingId) ?? '').localeCompare(
          buildingName.get(b.buildingId) ?? '',
        ) ||
        (level.get(a.floorId) ?? 0) - (level.get(b.floorId) ?? 0) ||
        String(a.codigo ?? '').localeCompare(String(b.codigo ?? '')),
    );
}

// Muestra (reservable) u oculta una sala propia; sin precio no se puede mostrar. Se lee y escribe
// en la misma transacción: una sala eliminada a la vez da 404 y nunca queda reservable.
export async function setRoomVisibility(companyId, id, visible) {
  const updated = await runTransaction(async (tx) => {
    const room = assertOwnedBy(await roomModel.findById(id, { tx }), companyId);
    if (room.status === 'INACTIVE') {
      throw new HttpError(400, 'ROOM_INACTIVE', 'La sala ya no está en el mapa');
    }
    const next = { ...room, bookable: visible };
    if (visible) assertPriceIfBookable(next);
    await roomModel.update(id, { bookable: visible }, { tx });
    return next;
  });
  const result = roomWithEstado(updated);
  if (visible) return result;
  result.reservasFuturas = await countFutureBookings([id]);
  const aviso = futureBookingsNotice(result.reservasFuturas, 'esta sala');
  return aviso ? { ...result, aviso } : result;
}

// Crea un edificio de la empresa en borrador.
export async function createBuilding(companyId, body) {
  const data = { ...buildingData(body), companyId, status: 'DRAFT' };
  data.description ??= '';
  data.photos ??= [];
  const id = await buildingModel.create(data);
  return buildingView({ id, ...data });
}

// Edita un edificio propio.
export async function updateBuilding(companyId, id, body) {
  const data = buildingData(body);
  const building = await runTransaction(async (tx) => {
    const current = assertOwnedBy(await buildingModel.findById(id, { tx }), companyId);
    await buildingModel.update(id, data, { tx });
    return current;
  });
  return buildingView({ ...building, ...data });
}

// Crea una planta en un edificio propio.
export async function createFloor(companyId, buildingId, body) {
  const data = { ...pick(body, FLOOR_MAP), companyId, buildingId, status: 'DRAFT', salas: [] };
  const id = await runTransaction(async (tx) => {
    // El edificio se lee en la transacción: si se elimina a la vez no se crea una planta huérfana.
    assertOwnedBy(await buildingModel.findById(buildingId, { tx }), companyId);
    await assertLevelFree(buildingId, data.level, undefined, tx);
    return floorModel.create(data, { tx });
  });
  return floorView({ id, ...data });
}

// Edita una planta propia.
export async function updateFloor(companyId, id, body) {
  const data = pick(body, FLOOR_MAP);
  const floor = await runTransaction(async (tx) => {
    const current = assertOwnedBy(await floorModel.findById(id, { tx }), companyId);
    if (data.level !== undefined) await assertLevelFree(current.buildingId, data.level, id, tx);
    await floorModel.update(id, data, { tx });
    return current;
  });
  return floorView({ ...floor, ...data });
}

// Edita los datos comerciales de una sala propia (el periodo de precio sigue siendo por hora).
// Se lee y escribe en la misma transacción: una sala eliminada a la vez da 404.
export async function updateRoom(companyId, id, body) {
  const data = pick(body, ROOM_MAP);
  if (data.price !== undefined) {
    data.pricePeriod = 'HOUR';
    data.isFree = false;
  }
  if (body?.gratis === true) {
    data.isFree = true;
    data.price = null;
  } else if (body?.gratis === false) {
    data.isFree = false;
  }
  const room = await runTransaction(async (tx) => {
    const current = assertOwnedBy(await roomModel.findById(id, { tx }), companyId);
    if (current.status === 'INACTIVE') {
      throw new HttpError(400, 'ROOM_INACTIVE', 'La sala ya no está en el mapa');
    }
    assertPriceIfBookable({ ...current, ...data });
    await roomModel.update(id, data, { tx });
    return current;
  });
  return roomView({ ...room, ...data });
}

// Respuesta en español de la empresa propia (la misma en GET y PATCH /companies/me).
function myCompanyView(company) {
  return {
    id: company.id,
    nombreEmpresa: company.name,
    cif: company.taxId,
    contacto: company.contactName ?? null,
    telefono: company.phone ?? null,
    emailContacto: company.email ?? null,
    ciudad: company.city ?? null,
    estado: companyEstado(company),
    motivo: companyMotivo(company),
    fechaSolicitud: toIso(company.resubmittedAt ?? company.createdAt) ?? null,
  };
}

// Empresa del usuario autenticado, solo con los campos públicos para su dueño.
export async function getMyCompany(companyId) {
  const company = companyId ? await companyModel.findById(companyId) : null;
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
  return myCompanyView(company);
}

const MY_COMPANY_MAP = {
  nombreEmpresa: 'name',
  cif: 'taxId',
  contacto: 'contactName',
  telefono: 'phone',
  emailContacto: 'email',
  ciudad: 'city',
};
// Campos que una empresa aprobada o suspendida sí puede cambiar.
const LIVE_EDITABLE = ['contacto', 'telefono', 'emailContacto'];

// Lanza 400 si una empresa aprobada o suspendida intenta cambiar campos protegidos.
// Un campo protegido con el mismo valor que el actual se ignora (se quita de `body`); solo da
// error si cambia. Devuelve el body sin esos campos.
function assertEditableFields(status, body, company) {
  if (status !== COMPANY_STATUS.APPROVED && status !== COMPANY_STATUS.SUSPENDED) return body;
  const rest = { ...body };
  const blocked = [];
  for (const [key, field] of Object.entries(MY_COMPANY_MAP)) {
    if (rest[key] === undefined || LIVE_EDITABLE.includes(key)) continue;
    if (rest[key] === company[field]) delete rest[key];
    else blocked.push(key);
  }
  if (blocked.length) {
    throw new HttpError(
      400,
      'FIELD_NOT_EDITABLE',
      'Con la empresa aprobada o suspendida solo puedes cambiar contacto, teléfono y email de contacto',
      { campos: blocked },
    );
  }
  return rest;
}

// Cambia el CIF dentro de la transacción: reserva el nuevo (409 si es de otra empresa) y libera el viejo.
async function moveTaxId(company, newCif, tx) {
  // Todas las lecturas antes de escribir.
  const entry = await companyTaxIdModel.findById(newCif, { tx });
  const old = company.taxId ? await companyTaxIdModel.findById(company.taxId, { tx }) : null;
  const claimable = entry && entry.companyId !== company.id && (await isOrphanTaxId(entry, tx));
  if (entry && entry.companyId !== company.id && !claimable) {
    throw new HttpError(409, 'COMPANY_EXISTS', 'Ya existe una empresa con ese CIF');
  }
  const doc = { taxId: newCif, companyId: company.id };
  if (claimable) await companyTaxIdModel.overwrite(newCif, doc, { tx });
  else if (!entry) await companyTaxIdModel.create(doc, { id: newCif, tx });
  // Solo se libera el CIF viejo si el índice era de esta empresa.
  if (old?.companyId === company.id) await companyTaxIdModel.remove(company.taxId, { tx });
}

// Edita la solicitud de la empresa propia. Pendiente o rechazada: todo (rechazada vuelve a
// pendiente); aprobada o suspendida: solo contacto, teléfono y email de contacto.
export async function updateMyCompany(companyId, body) {
  if (!companyId) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
  try {
    await runTransaction(async (tx) => {
      const company = await companyModel.findById(companyId, { tx });
      if (!company) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
      const status = companyStatus(company);
      const data = pick(assertEditableFields(status, body, company), MY_COMPANY_MAP);
      if (data.taxId !== undefined && data.taxId === company.taxId) delete data.taxId;
      if (data.taxId !== undefined) await moveTaxId(company, data.taxId, tx);
      if (status === COMPANY_STATUS.REJECTED) {
        Object.assign(data, {
          status: COMPANY_STATUS.PENDING,
          verified: false,
          lastRejectionReason: company.rejectionReason ?? null,
          rejectionReason: null,
          resubmittedAt: now(),
        });
      }
      await companyModel.update(companyId, data, { tx });
    });
  } catch (err) {
    if (companyTaxIdModel.isAlreadyExists(err)) {
      throw new HttpError(409, 'COMPANY_EXISTS', 'Ya existe una empresa con ese CIF');
    }
    throw err;
  }
  return getMyCompany(companyId);
}
