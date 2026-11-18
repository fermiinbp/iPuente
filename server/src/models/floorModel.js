// Acceso a la colección floors. Campos: companyId, buildingId, name, level, mapImageUrl, status (DRAFT | PUBLISHED), createdAt, updatedAt
// y el mapa en el formato del editor: ancho, alto, origen (manual | ia) y salas (id, codigo, nombre, tipo, x, y, w, h).
// El id de cada sala del mapa es el id de su documento en rooms.
import { createModel } from './baseModel.js';

const base = createModel('floors');

export const { findById, create, upsert, update, remove } = base;

// Plantas de un edificio ordenadas de abajo arriba.
export function listByBuilding(buildingId) {
  return base.listBy('buildingId', buildingId, { orderBy: 'level' });
}

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId);
}
