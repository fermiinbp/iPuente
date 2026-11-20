// Acceso a la colección counters: un documento por contador (p. ej. `bookings`) con el campo
// `value` (último número usado), updatedAt. Solo acceso a datos: quién calcula el siguiente es el service.
import { createModel, now } from './baseModel.js';

const base = createModel('counters');

export const { findById } = base;

// Último valor guardado del contador (0 si todavía no existe). Acepta { tx } para leer en transacción.
export async function getValue(name, { tx } = {}) {
  const counter = await base.findById(name, { tx });
  return Number(counter?.value) || 0;
}

// Guarda el valor del contador (set con merge). Con { tx } se escribe dentro de la transacción.
export async function setValue(name, value, { tx } = {}) {
  const ref = base.docRef(name);
  const data = { value, updatedAt: now() };
  if (tx) tx.set(ref, data, { merge: true });
  else await ref.set(data, { merge: true });
  return value;
}
