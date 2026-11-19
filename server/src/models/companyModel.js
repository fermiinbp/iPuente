// Acceso a la colección companies y a su subcolección members (userId, role OWNER | MANAGER | EMPLOYEE, joinedAt). Campos: name, legalName, taxId (CIF normalizado), contactName, description, logoUrl, email, phone, address, ownerUid, status (PENDING | APPROVED | REJECTED), verified (status === APPROVED), createdAt, updatedAt.
import { createModel, now, runQuery, toObject } from './baseModel.js';

const base = createModel('companies');

export const { findById, create, upsert, update, remove } = base;

// Empresas aprobadas (true) o pendientes (false).
export function listByVerified(verified) {
  return base.listBy('verified', verified);
}

// Empresa con ese CIF (ya normalizado), o null si no existe.
export async function findByTaxId(taxId) {
  const [company] = await runQuery(base.collection().where('taxId', '==', taxId), { limit: 1 });
  return company ?? null;
}

// Subcolección members: el id del documento es el userId.
const members = (companyId) => base.docRef(companyId).collection('members');

export async function setMember(companyId, userId, role) {
  await members(companyId).doc(userId).set({ userId, role, joinedAt: now() }, { merge: true });
  return userId;
}

export async function findMember(companyId, userId) {
  return toObject(await members(companyId).doc(userId).get());
}

export function listMembers(companyId) {
  return runQuery(members(companyId));
}

export async function removeMember(companyId, userId) {
  await members(companyId).doc(userId).delete();
}
