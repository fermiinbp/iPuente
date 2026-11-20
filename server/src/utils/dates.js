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

// Suma días a una fecha AAAA-MM-DD (hora local) y devuelve AAAA-MM-DD.
export function addDays(fecha, days) {
  const [y, m, d] = fecha.split('-').map(Number);
  return todayString(new Date(y, m - 1, d + days));
}

// Días entre dos fechas AAAA-MM-DD (hasta - desde).
export function daysBetween(desde, hasta) {
  const ms = (s) => Date.parse(`${s}T00:00:00Z`);
  return Math.round((ms(hasta) - ms(desde)) / (24 * 60 * 60 * 1000));
}

// Mes natural de una fecha (hora local, Europe/Madrid): rango [from, to) y `mes` como AAAA-MM.
export function monthRange(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to, mes: `${from.getFullYear()}-${pad(from.getMonth() + 1)}` };
}

// Rango de un listado con valores por defecto: desde = hoy - 30 días y hasta = desde + 90 días.
export function resolveRange({ desde, hasta } = {}, today = todayString()) {
  const from = desde ?? addDays(today, -30);
  return { desde: from, hasta: hasta ?? addDays(from, 90) };
}
