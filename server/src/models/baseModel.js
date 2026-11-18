// Funciones comunes a todos los models: leer, crear, actualizar y listar documentos de una colección.
// Solo acceso a datos: las reglas de negocio (solapes, precios, permisos) van en services/.
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../config/config.js';

// Convierte un snapshot de Firestore en un objeto plano con su id (o null si no existe).
export function toObject(snap) {
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// Marca de tiempo del servidor para createdAt y updatedAt.
export const now = () => FieldValue.serverTimestamp();

// Ejecuta una consulta y devuelve sus documentos como objetos planos.
// Con { tx } la lee dentro de una transacción de Firestore.
export async function runQuery(query, { orderBy, direction = 'asc', limit, tx } = {}) {
  let q = query;
  if (orderBy) q = q.orderBy(orderBy, direction);
  if (limit) q = q.limit(limit);
  const snap = tx ? await tx.get(q) : await q.get();
  return snap.docs.map(toObject);
}

// Crea las funciones básicas de un model para la colección indicada.
// Todas aceptan { tx } para usarse dentro de una transacción de Firestore.
export function createModel(collectionName) {
  const collection = () => db().collection(collectionName);
  const docRef = (id) => (id ? collection().doc(id) : collection().doc());

  async function findById(id, { tx } = {}) {
    const ref = docRef(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    return toObject(snap);
  }

  // Crea un documento nuevo; falla si ya existe uno con ese id. Devuelve el id.
  async function create(data, { id, tx } = {}) {
    const ref = docRef(id);
    const doc = { ...data, createdAt: now(), updatedAt: now() };
    if (tx) tx.create(ref, doc);
    else await ref.create(doc);
    return ref.id;
  }

  // Crea o actualiza un documento con id fijo (set con merge). Conserva createdAt si ya existía.
  // Pensado para el seed y para datos con id conocido (p. ej. users, cuyo id es el UID).
  async function upsert(id, data) {
    const ref = docRef(id);
    const snap = await ref.get();
    const doc = { ...data, updatedAt: now() };
    if (!snap.exists) doc.createdAt = now();
    await ref.set(doc, { merge: true });
    return id;
  }

  // Actualiza campos de un documento existente; falla si no existe.
  async function update(id, data, { tx } = {}) {
    const ref = docRef(id);
    const doc = { ...data, updatedAt: now() };
    if (tx) tx.update(ref, doc);
    else await ref.update(doc);
    return id;
  }

  async function remove(id, { tx } = {}) {
    const ref = docRef(id);
    if (tx) tx.delete(ref);
    else await ref.delete();
  }

  // Lista los documentos cuyo campo coincide con el valor (field == value).
  function listBy(field, value, options) {
    return runQuery(collection().where(field, '==', value), options);
  }

  return { collection, docRef, findById, create, upsert, update, remove, listBy };
}
