// Acceso a la colección buildings. Campos: companyId, name, description, address, city, postalCode, country, latitude, longitude, floorCount, status (DRAFT | PUBLISHED), createdAt, updatedAt.
import { createModel } from './baseModel.js';

const base = createModel('buildings');

export const { findById, create, upsert, update, remove } = base;

export function listByCompany(companyId) {
  return base.listBy('companyId', companyId);
}

export function listByStatus(status) {
  return base.listBy('status', status);
}
