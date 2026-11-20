// Acceso a la colección companies y a su subcolección members (userId, role OWNER | MANAGER | EMPLOYEE, joinedAt). Campos: name, legalName, taxId (CIF normalizado), contactName, description, logoUrl, email, phone, address, ownerUid, status (PENDING | APPROVED | REJECTED | SUSPENDED), verified (status === APPROVED), city, termsAcceptedAt (aceptación de condiciones en el alta), rejectionReason, lastRejectionReason (motivo del último rechazo, guardado al reenviar), resubmittedAt (último reenvío tras un rechazo), suspensionReason, lastSuspensionReason, reviewedAt, reviewedBy (uid del admin), createdAt, updatedAt.
import { FieldPath } from 'firebase-admin/firestore';

import { createModel, now, runQuery, toObject } from './baseModel.js';

const base = createModel('companies');

export const { findById, create, upsert, update, remove, countWhere } = base;

// Todas las empresas (el panel de admin filtra y ordena en memoria).
export function listAll() {
  return runQuery(base.collection());
}

// Empresas con esos ids, en lotes de 30 (límite de `in`): una consulta por lote. Las que no
// existen no aparecen en el resultado.
export async function findByIds(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) => runQuery(base.collection().where(FieldPath.documentId(), 'in', chunk))),
  );
  return results.flat();
}

// Empresas cuyo ownerUid está en la lista, en lotes de 30 (límite de `in`).
export async function findByOwnerUids(uids) {
  const unique = [...new Set(uids)].filter(Boolean);
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) => runQuery(base.collection().where('ownerUid', 'in', chunk))),
  );
  return results.flat();
}

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
