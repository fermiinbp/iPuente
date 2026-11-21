// Reservas y bloqueos del panel de empresa (EMP013): rangos del filtro de fecha, filas de la tabla (reservas y
// bloqueos juntos, porque la API los da por separado) y choques de una franja con lo que ya hay en la sala.
import { BOOKING_DISPLAY_STATUS, BOOKING_STATUS } from '@/config/constants.js';
import { todayString } from '@/utils/dates.js';

// Fecha AAAA-MM-DD desplazada `days` días (en hora local).
export function shiftDate(fecha, days) {
  const [year, month, day] = fecha.split('-').map(Number);
  return todayString(new Date(year, month - 1, day + days));
}

// Opciones del filtro «Fecha». La primera es la de por defecto.
export const DATE_RANGES = [
  { value: 'proximos30', label: 'Próximos 30 días' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'proximos7', label: 'Próximos 7 días' },
  { value: 'mes', label: 'Este mes' },
  { value: 'proximos90', label: 'Próximos 90 días' },
  { value: 'ultimos30', label: 'Últimos 30 días' },
];

export const DEFAULT_RANGE = DATE_RANGES[0].value;

// { desde, hasta } (inclusive) de una opción del filtro. Un valor desconocido usa la de por defecto.
export function rangeFor(value, now = new Date()) {
  const today = todayString(now);
  switch (value) {
    case 'hoy':
      return { desde: today, hasta: today };
    case 'proximos7':
      return { desde: today, hasta: shiftDate(today, 6) };
    case 'mes':
      return {
        desde: todayString(new Date(now.getFullYear(), now.getMonth(), 1)),
        hasta: todayString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case 'proximos90':
      return { desde: today, hasta: shiftDate(today, 89) };
    case 'ultimos30':
      return { desde: shiftDate(today, -30), hasta: shiftDate(today, -1) };
    default:
      return { desde: today, hasta: shiftDate(today, 29) };
  }
}

// Reservas y bloqueos en una sola lista, por fecha y hora de inicio. Cada fila lleva `tipo` ('reserva' o 'bloqueo')
// y una `key` única (una reserva y un bloqueo podrían compartir id). Los bloqueos tienen el estado «Bloqueada».
export function mergeRows(bookings = [], blocks = []) {
  const rows = [
    ...bookings.map((b) => ({ ...b, tipo: 'reserva', key: `reserva-${b.id}` })),
    ...blocks.map((b) => ({
      ...b,
      tipo: 'bloqueo',
      key: `bloqueo-${b.id}`,
      estado: BOOKING_DISPLAY_STATUS.BLOCKED,
    })),
  ];
  return rows.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.inicio - b.inicio ||
      (a.sala?.codigo ?? '').localeCompare(b.sala?.codigo ?? ''),
  );
}

// Reservas que ocupan la sala (las canceladas y caducadas ya no).
const OCCUPYING = new Set([BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_PAYMENT]);

// Misma regla de solape que la API: nuevoInicio < existenteFin && nuevoFin > existenteInicio.
const overlaps = (a, b) => a.inicio < b.fin && a.fin > b.inicio;

// Reservas y bloqueos de `items` (ya filtrados por sala y fecha) que chocan con la franja [inicio, fin).
export function findConflicts({ bookings = [], blocks = [] }, { inicio, fin }) {
  const slot = { inicio, fin };
  return {
    bookings: bookings.filter((b) => OCCUPYING.has(b.estado) && overlaps(b, slot)),
    blocks: blocks.filter((b) => overlaps(b, slot)),
  };
}

// «9:00 – 14:00».
export const formatSlot = ({ inicio, fin }) => `${inicio}:00 – ${fin}:00`;
