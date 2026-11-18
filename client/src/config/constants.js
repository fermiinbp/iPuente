// Constantes compartidas del front: URL de la API, roles (CLIENT, COMPANY, ADMIN), estados de sala, de reserva y de pago, y horario reservable.
export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export const ROLES = Object.freeze({
  CLIENT: 'CLIENT',
  COMPANY: 'COMPANY',
  ADMIN: 'ADMIN',
});

export const ROOM_STATUS = Object.freeze({
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const BOOKING_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  COMPLETED: 'COMPLETED',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

export const BOOKING_HOURS = Object.freeze({ start: 8, end: 20 });
