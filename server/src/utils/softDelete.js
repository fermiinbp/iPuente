// Borrado lógico: un edificio, planta o sala con historial de reservas no se borra, se marca con deletedAt.

// ¿El documento está eliminado lógicamente?
export function isDeleted(doc) {
  return Boolean(doc?.deletedAt);
}

// Para usar en .filter: deja solo los documentos que no están eliminados.
export function notDeleted(doc) {
  return !isDeleted(doc);
}
