// Acceso a la colección floors. Campos: companyId, buildingId, name, level, mapImageUrl, status (DRAFT | PUBLISHED), deletedAt (borrado lógico: solo si alguna sala tenía reservas), createdAt, updatedAt
// y el mapa en el formato del editor: ancho, alto, origen (manual | ia) y salas (id, codigo, nombre, tipo, x, y, w, h).
// El id de cada sala del mapa es el id de su documento en rooms.
import { createModel } from './baseModel.js';

const base = createModel('floors');

export const { findById, create, upsert, update, remove } = base;

// Plantas de un edificio ordenadas de abajo arriba.
// Con { tx } la consulta se lee dentro de una transacción.
// Con { limit } devuelve como mucho ese número de plantas.
export function listByBuilding(buildingId, { tx, limit } = {}) {
  return base.listBy('buildingId', buildingId, { orderBy: 'level', tx, limit });
}

export function listByCompany(companyId, { limit } = {}) {
  return base.listBy('companyId', companyId, { limit });
}

// Plantas con un estado (DRAFT | PUBLISHED) de todas las empresas.
export function listByStatus(status) {
  return base.listBy('status', status);
}
