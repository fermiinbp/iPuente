// Reglas y textos del formulario de reserva de la ficha de sala, compartidos por `BookingForm` y por la barra
// fija de móvil de `Room`, para que los dos digan lo mismo.
import { priceLabel } from './formatPrice.js';

const pad = (hour) => String(hour).padStart(2, '0');

// Asistentes: opcional, pero si se escribe debe ser 1 o más y no pasar de la capacidad de la sala.
// Devuelve el mensaje de error en español o '' si es válido.
export function attendeesError(attendees, capacity) {
  const count = attendees === '' ? null : Number(attendees);
  if (count !== null && !(Number.isInteger(count) && count >= 1)) {
    return 'Indica al menos 1 asistente.';
  }
  if (count !== null && capacity && count > capacity) {
    return `La sala admite como máximo ${capacity} personas.`;
  }
  return '';
}

// Texto de la barra fija: con franja, el total y la franja; sin ella, el precio por hora y qué falta hacer.
// `selection` es { inicio, fin } (fin no incluido) o null.
export function barSummary({ selection, pricePerHour }) {
  if (!selection) {
    return { amount: priceLabel(pricePerHour, { perHour: true }), detail: 'Elige las horas' };
  }
  const hours = selection.fin - selection.inicio;
  return {
    amount: priceLabel(pricePerHour * hours),
    detail: `${pad(selection.inicio)}:00 – ${pad(selection.fin)}:00 · ${hours} ${hours === 1 ? 'hora' : 'horas'}`,
  };
}
