// Acceso a la colección rooms (las salas). El id de cada documento es el id de la sala en floors.salas.
// Campos: companyId, buildingId, floorId, name, code, type (sala | box | comun | cocina | pasillo), description, surface, capacity,
// price, pricePeriod (HOUR), amenities, bookable, status (ACTIVE | INACTIVE), openingHours, deletedAt (borrado lógico: solo si tenía reservas), createdAt, updatedAt.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('rooms');

export const { findById, create, upsert, update, remove } = base;

// Con { tx } la consulta se lee dentro de una transacción.
// Con { limit } devuelve como mucho ese número de salas.
export function listByFloor(floorId, { tx, limit } = {}) {
  return base.listBy('floorId', floorId, { tx, limit });
}

// Con { tx } la consulta se lee dentro de una transacción.
export function listByBuilding(buildingId, { tx, limit } = {}) {
  return base.listBy('buildingId', buildingId, { tx, limit });
}

// Salas de varios edificios, en lotes de 30 ids (límite de `in`): una consulta por lote.
export async function listByBuildings(buildingIds) {
  const chunks = [];
  for (let i = 0; i < buildingIds.length; i += 30) chunks.push(buildingIds.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((ids) => runQuery(base.collection().where('buildingId', 'in', ids))),
  );
  return results.flat();
}

export function listByCompany(companyId, { limit } = {}) {
  return base.listBy('companyId', companyId, { limit });
}
