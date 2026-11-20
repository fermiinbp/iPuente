// Utilidades de fechas: formato AAAA-MM-DD, horas y rangos para el calendario.

// Hoy en hora local como AAAA-MM-DD (toISOString usaría UTC y puede dar el día anterior).
export function todayString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// «jueves, 20 de noviembre» a partir de AAAA-MM-DD.
export function formatLongDate(fecha) {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ¿Ya ha empezado la reserva? `fecha` es AAAA-MM-DD e `inicio` la hora entera de comienzo.
export function hasStarted({ fecha, inicio }) {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(year, month - 1, day, inicio).getTime() <= Date.now();
}
