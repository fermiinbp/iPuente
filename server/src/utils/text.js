// Utilidades de texto: normalizar para comparar sin mayúsculas, tildes ni espacios de más.

// Minúsculas, sin tildes (NFD sin diacríticos), sin espacios en los extremos y con los internos
// colapsados. Tolera null y undefined (devuelven '').
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
