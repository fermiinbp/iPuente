// Utilidades de fechas y horas: validar AAAA-MM-DD, comparar franjas y calcular caducidades.

const pad = (n) => String(n).padStart(2, '0');

// true si es AAAA-MM-DD y una fecha real del calendario (2026-02-30 no vale).
export function isValidDateString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Fecha de hoy (hora local) como AAAA-MM-DD.
export function todayString(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Rango [from, to) de un día AAAA-MM-DD, en hora local.
export function dayRange(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return { from: new Date(y, m - 1, d), to: new Date(y, m - 1, d + 1) };
}
