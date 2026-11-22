// Horario reservable acordado: de 8:00 a 20:00 (la última hora libre empieza a las 19).
export const BOOKING_HOURS = { desde: 8, hasta: 20 };

// Minutos que retiene las horas una reserva PENDING_PAYMENT recién creada (y respaldo de caducidad
// cuando falta expiresAt).
export const PENDING_MINUTES = 15;

// Tope absoluto de retención de una reserva PENDING_PAYMENT, en minutos desde su createdAt: ni
// ampliar la sesión de pago ni abrir otros intentos pueden sostener las horas más allá.
export const PENDING_MAX_HOLD_MINUTES = 50;
