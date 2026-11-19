// Reglas de empresas: estado (PENDING, APPROVED, REJECTED) y su nombre en español, y consulta de la empresa propia.
import * as buildingModel from '../models/buildingModel.js';
import * as companyModel from '../models/companyModel.js';
import { runTransaction } from '../models/baseModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { HttpError } from '../utils/httpError.js';
import { getOwnedBuilding, getOwnedFloor, getOwnedRoom } from './ownershipService.js';

export const COMPANY_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const STATUS_ES = {
  [COMPANY_STATUS.PENDING]: 'pendiente',
  [COMPANY_STATUS.APPROVED]: 'aprobada',
  [COMPANY_STATUS.REJECTED]: 'rechazada',
};

// Estado en español de una empresa. Si es antigua y no tiene status, se deriva de verified.
export function companyEstado(company) {
  if (STATUS_ES[company?.status]) return STATUS_ES[company.status];
  return company?.verified === true ? 'aprobada' : 'pendiente';
}

// Convierte un timestamp de Firestore (o fecha) a ISO; si no hay, undefined.
function toIso(value) {
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
    precioHora: r.price ?? null,
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
};
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

// Lanza 409 si otra planta del edificio ya tiene ese número.
// Se lee dentro de la transacción recibida para evitar carreras.
async function assertLevelFree(buildingId, level, exceptFloorId, tx) {
  const floors = await floorModel.listByBuilding(buildingId, { tx });
  if (floors.some((f) => f.level === level && f.id !== exceptFloorId)) {
    throw new HttpError(409, 'FLOOR_EXISTS', 'Ya existe una planta con ese número en el edificio');
  }
}

// Edificios de la empresa.
export async function listBuildings(companyId) {
  return (await buildingModel.listByCompany(companyId)).map(buildingView);
}

// Crea un edificio de la empresa en borrador.
export async function createBuilding(companyId, body) {
  const data = { ...pick(body, BUILDING_MAP), companyId, status: 'DRAFT' };
  data.description ??= '';
  data.photos ??= [];
  const id = await buildingModel.create(data);
  return buildingView({ id, ...data });
}

// Edita un edificio propio.
export async function updateBuilding(companyId, id, body) {
  const building = await getOwnedBuilding(id, companyId);
  const data = pick(body, BUILDING_MAP);
  await buildingModel.update(id, data);
  return buildingView({ ...building, ...data });
}

// Crea una planta en un edificio propio.
export async function createFloor(companyId, buildingId, body) {
  await getOwnedBuilding(buildingId, companyId);
  const data = { ...pick(body, FLOOR_MAP), companyId, buildingId, status: 'DRAFT', salas: [] };
  const id = await runTransaction(async (tx) => {
    await assertLevelFree(buildingId, data.level, undefined, tx);
    return floorModel.create(data, { tx });
  });
  return floorView({ id, ...data });
}

// Edita una planta propia.
export async function updateFloor(companyId, id, body) {
  const floor = await getOwnedFloor(id, companyId);
  const data = pick(body, FLOOR_MAP);
  await runTransaction(async (tx) => {
    if (data.level !== undefined) await assertLevelFree(floor.buildingId, data.level, id, tx);
    await floorModel.update(id, data, { tx });
  });
  return floorView({ ...floor, ...data });
}

// Edita los datos comerciales de una sala propia (el periodo de precio sigue siendo por hora).
export async function updateRoom(companyId, id, body) {
  const room = await getOwnedRoom(id, companyId);
  const data = pick(body, ROOM_MAP);
  if (data.price !== undefined) data.pricePeriod = 'HOUR';
  await roomModel.update(id, data);
  return roomView({ ...room, ...data });
}

// Empresa del usuario autenticado, solo con los campos públicos para su dueño.
export async function getMyCompany(companyId) {
  const company = companyId ? await companyModel.findById(companyId) : null;
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
  return {
    id: company.id,
    name: company.name,
    taxId: company.taxId,
    contactName: company.contactName ?? null,
    phone: company.phone ?? null,
    email: company.email ?? null,
    estado: companyEstado(company),
    createdAt: toIso(company.createdAt),
  };
}
