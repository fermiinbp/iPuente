// Acceso a la colección rooms (las salas). El id de cada documento es el id de la sala en floors.salas.
// Campos: companyId, buildingId, floorId, name, code, type (sala | box | comun | cocina | pasillo), description, surface, capacity,
// price, pricePeriod (HOUR), amenities, bookable, status (ACTIVE | INACTIVE), openingHours, createdAt, updatedAt.
import { createModel } from './baseModel.js';

const base = createModel('rooms');

export const { findById, create, upsert, update, remove } = base;

export function listByFloor(floorId) {
  return base.listBy('floorId', floorId);
}

export function listByBuilding(buildingId) {
  return base.listBy('buildingId', buildingId);
}

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId);
}
