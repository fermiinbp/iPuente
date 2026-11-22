// Necesidades de una sala (personas y equipamiento): regla común del buscador y del mapa de planta.
import { normalizeText } from './text.js';

// Equipamiento pedido (CSV o lista) a una lista normalizada: sin tildes, en minúsculas y sin vacíos.
export function parseEquipamiento(valor) {
  if (valor === undefined || valor === null) return [];
  const items = Array.isArray(valor) ? valor : String(valor).split(',');
  return items.map(normalizeText).filter(Boolean);
}

// ¿La sala cubre las necesidades? `equipamiento` ya normalizado (parseEquipamiento).
// Con `personas`, una sala sin capacidad no encaja; debe tener todo el equipamiento pedido.
export function matchesNeeds(room, { personas, equipamiento = [] } = {}) {
  if (personas !== undefined && !(room.capacity >= personas)) return false;
  if (equipamiento.length > 0) {
    // Un dato corrupto (amenities que no es una lista) cuenta como sala sin equipamiento.
    const amenities = Array.isArray(room.amenities) ? room.amenities : [];
    const have = new Set(amenities.map(normalizeText));
    if (!equipamiento.every((item) => have.has(item))) return false;
  }
  return true;
}
