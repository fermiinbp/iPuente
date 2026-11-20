// Acceso a la colección companyTaxIds: índice de CIF únicos (id = CIF normalizado). Crear su documento con create() falla si ya existe, así dos registros simultáneos no pueden repetir CIF. Campos: taxId, companyId, createdAt, updatedAt.
import { createModel } from './baseModel.js';

const base = createModel('companyTaxIds');

export const { findById, create, upsert, update, remove } = base;

// Código gRPC 6 (ALREADY_EXISTS) que lanza Firestore al crear un documento que ya existe.
export const isAlreadyExists = (err) => err?.code === 6 || err?.code === 'already-exists';

// Sobrescribe el documento de un CIF (descarta lo anterior). Con { tx } dentro de una transacción.
export async function overwrite(cif, data, { tx } = {}) {
  const ref = base.docRef(cif);
  const doc = { ...data, createdAt: new Date(), updatedAt: new Date() };
  if (tx) tx.set(ref, doc);
  else await ref.set(doc);
}
