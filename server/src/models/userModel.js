// Acceso a la colección users (id = UID de Firebase Auth). Campos: name, surname, email, phone, role (CLIENT | COMPANY | ADMIN), createdAt, updatedAt.
import { createModel, runQuery } from './baseModel.js';

const base = createModel('users');

export const { findById, create, upsert, update, remove, countWhere } = base;

export async function findByEmail(email) {
  const [user] = await runQuery(base.collection().where('email', '==', email), { limit: 1 });
  return user ?? null;
}

export function listByRole(role) {
  return base.listBy('role', role);
}

// Usuarios (hasta `limit`), los más recientes primero, con filtro opcional por rol (índice
// role + createdAt DESC). El panel de admin busca en memoria.
export function listAll({ role, limit = 1000 } = {}) {
  const query = role ? base.collection().where('role', '==', role) : base.collection();
  return runQuery(query, { orderBy: 'createdAt', direction: 'desc', limit });
}
