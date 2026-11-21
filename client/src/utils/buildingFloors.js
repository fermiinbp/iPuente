// Plantas del formulario de edificio (EMP004): pasar de la lista que edita la pantalla a las llamadas a la API.
// La lista va de arriba abajo, como la fachada (la primera fila es la planta más alta). El orden real de una planta
// es su `numero` (entero de -10 a 200, único en el edificio): la de abajo del todo se queda con el número más bajo
// de las plantas que ya existían (0 en un edificio nuevo) y cada una de encima suma 1.
// Como la API no deja dos plantas con el mismo número (409 FLOOR_EXISTS), reordenar se hace en dos pasos: primero
// las plantas que cambian de número van a números libres temporales y después a su número final.

export const MIN_LEVEL = -10;
export const MAX_LEVEL = 200;

let nextKey = 0;
const newKey = () => `nueva-${(nextKey += 1)}`;

// Filas de la pantalla a partir de las plantas de la API (que llegan de abajo arriba).
// Fila: { key, id (null si es nueva), nombre, originalNombre, numero (el actual en la API o null), removed }.
export function rowsFromFloors(floors = []) {
  return [...floors]
    .sort((a, b) => b.numero - a.numero)
    .map((f) => ({
      key: f.id,
      id: f.id,
      nombre: f.nombre,
      originalNombre: f.nombre,
      numero: f.numero,
      removed: false,
    }));
}

// Fila nueva para «Añadir planta» (se añade arriba del todo, como una planta más alta).
export function newRow(nombre = '') {
  return { key: newKey(), id: null, nombre, originalNombre: null, numero: null, removed: false };
}

// Nombre que se propone para una planta nueva según cuántas hay debajo.
export function suggestedName(rowsBelow) {
  return rowsBelow === 0 ? 'Planta baja' : `Planta ${rowsBelow}`;
}

// Número final de cada fila viva: { [key]: numero }.
export function targetLevels(rows) {
  const alive = rows.filter((r) => !r.removed);
  const existing = alive.filter((r) => r.id !== null).map((r) => r.numero);
  const base = existing.length > 0 ? Math.min(...existing) : 0;
  const levels = {};
  alive.forEach((row, index) => {
    levels[row.key] = base + (alive.length - 1 - index);
  });
  return levels;
}

// ¿Caben todas las plantas en el rango que admite la API?
export function levelsInRange(rows) {
  return Object.values(targetLevels(rows)).every((n) => n >= MIN_LEVEL && n <= MAX_LEVEL);
}

// Plan de cambios de las plantas, en el orden en que hay que aplicarlos:
// - remove: [{ id, nombre }] plantas existentes que se eliminan.
// - park: [{ id, numero }] números temporales (libres) para las que cambian de número.
// - update: [{ id, datos: { numero?, nombre? } }] número final y nombre nuevo.
// - create: [{ key, datos: { numero, nombre } }] plantas nuevas.
export function planFloorChanges(rows) {
  const levels = targetLevels(rows);
  const alive = rows.filter((r) => !r.removed);
  const remove = rows
    .filter((r) => r.removed && r.id !== null)
    .map((r) => ({ id: r.id, nombre: r.nombre }));

  const moving = alive.filter((r) => r.id !== null && r.numero !== levels[r.key]);
  // Libres para aparcar: ni ocupados por las que se quedan ni destino de ninguna, buscando desde arriba.
  const busy = new Set([
    ...alive.filter((r) => r.id !== null).map((r) => r.numero),
    ...Object.values(levels),
  ]);
  const park = [];
  for (let n = MAX_LEVEL; n >= MIN_LEVEL && park.length < moving.length; n -= 1) {
    if (!busy.has(n)) park.push({ id: moving[park.length].id, numero: n });
  }

  const update = [];
  for (const row of alive.filter((r) => r.id !== null)) {
    const datos = {};
    if (row.numero !== levels[row.key]) datos.numero = levels[row.key];
    if (row.nombre.trim() !== row.originalNombre) datos.nombre = row.nombre.trim();
    if (Object.keys(datos).length > 0) update.push({ id: row.id, datos });
  }

  const create = alive
    .filter((r) => r.id === null)
    .map((r) => ({ key: r.key, datos: { numero: levels[r.key], nombre: r.nombre.trim() } }));

  return { remove, park, update, create };
}
