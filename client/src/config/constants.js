// Constantes compartidas del front: URL de la API, roles (CLIENT, COMPANY, ADMIN), estados de sala, edificio y planta, reserva, pago, empresa y cuenta de cobro, y horario reservable.
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

// Estado de una sala en el panel de empresa (wireframe 14b).
export const ROOM_LISTING_STATUS = Object.freeze({
  PUBLISHED: 'PUBLISHED',
  NO_PRICE: 'NO_PRICE',
  HIDDEN: 'HIDDEN',
});

// Estado de publicación de un edificio o una planta (wireframes 12 y 13).
export const PUBLISH_STATUS = Object.freeze({
  PUBLISHED: 'PUBLISHED',
  DRAFT: 'DRAFT',
});

// Estados de reserva que calcula la pantalla y que NO existen en la API: la API solo tiene
// CANCELLED (sin quién canceló ni el reembolso) y guarda los bloqueos en la colección blocks.
export const BOOKING_DISPLAY_STATUS = Object.freeze({
  CANCELLED_BY_CLIENT: 'CANCELLED_BY_CLIENT',
  CANCELLED_BY_SPACE: 'CANCELLED_BY_SPACE',
  REFUND_PENDING: 'REFUND_PENDING',
  BLOCKED: 'BLOCKED',
});

// Estado de una empresa (wireframes 17 y 17b). En minúscula, como las claves de StatusBadge.
// La API tiene PENDING, APPROVED y REJECTED; «suspendida» todavía no existe.
export const COMPANY_STATUS = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});

// Estado de la cuenta de cobro con Stripe Connect (wireframe 25). Pendiente de decidir con back.
export const PAYOUT_ACCOUNT_STATUS = Object.freeze({
  NOT_CONNECTED: 'NOT_CONNECTED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
});

export const BOOKING_HOURS = Object.freeze({ start: 8, end: 20 });

// Mínimo de caracteres de una contraseña nueva (registro, recuperar y cambiar contraseña).
export const MIN_PASSWORD = 8;

// Página a la que se va tras entrar si no se venía de otra: cliente a la home, empresa y admin a su panel.
export const ROLE_HOME = Object.freeze({
  [ROLES.CLIENT]: '/',
  [ROLES.COMPANY]: '/company',
  [ROLES.ADMIN]: '/admin',
});

// Imágenes que se pueden subir a Firebase Storage (planos, fotos de edificio y de sala). Son las mismas reglas que
// `storage.rules`: si cambian allí, se cambian aquí. El tamaño tiene que ser mayor que 0 y menor que `maxBytes`.
export const IMAGE_UPLOAD = Object.freeze({
  types: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  maxBytes: 5 * 1024 * 1024,
  typesLabel: 'PNG, JPG, WebP o GIF',
  hint: 'PNG, JPG, WebP o GIF · menos de 5 MB',
});
