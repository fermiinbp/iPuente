// Acceso a la colección rateLimits: un contador por clave de límite (id = hash). Campos: count, expiresAt (fin de la ventana; sirve para una política TTL de Firestore), createdAt, updatedAt.
import { createModel, runTransaction } from './baseModel.js';

const base = createModel('rateLimits');

export const { findById, remove } = base;

// Fecha de un campo que puede ser Date o Timestamp de Firestore.
const toMillis = (value) => (typeof value?.toMillis === 'function' ? value.toMillis() : +value);

// Suma 1 al contador de forma atómica (transacción). Si no existe o su ventana acabó, empieza
// otro con expiresAt = ahora + windowMs. Devuelve { totalHits, resetTime }.
export function hit(id, windowMs) {
  return runTransaction(async (tx) => {
    const current = await base.findById(id, { tx });
    const nowMs = Date.now();
    if (!current || toMillis(current.expiresAt) <= nowMs) {
      const expiresAt = new Date(nowMs + windowMs);
      tx.set(base.docRef(id), {
        count: 1,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { totalHits: 1, resetTime: expiresAt };
    }
    tx.update(base.docRef(id), { count: current.count + 1, updatedAt: new Date() });
    return { totalHits: current.count + 1, resetTime: new Date(toMillis(current.expiresAt)) };
  });
}

// Resta 1 al contador si sigue vigente (sin bajar de 0).
export function release(id) {
  return runTransaction(async (tx) => {
    const current = await base.findById(id, { tx });
    if (!current || toMillis(current.expiresAt) <= Date.now()) return;
    tx.update(base.docRef(id), { count: Math.max(0, current.count - 1), updatedAt: new Date() });
  });
}
