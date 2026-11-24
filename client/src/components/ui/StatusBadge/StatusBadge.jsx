// Etiqueta de estado, siempre con texto. `kind` elige el grupo de estados (valores en config/constants.js):
// 'room' (por defecto; sala en el plano), 'booking' (reserva), 'company' (empresa),
// 'roomListing' (sala en el panel de empresa), 'publish' (edificio y planta), 'payment' (pago)
// y 'payoutAccount' (cuenta de cobro con Stripe).
// «No se alquila» además lleva trama diagonal.
import styles from './StatusBadge.module.css';

const ROOM_FREE = { label: 'Libre', className: styles.free };
const ROOM_OCCUPIED = { label: 'Ocupada', className: styles.occupied };
const ROOM_OFF = { label: 'No se alquila', className: styles.off };

const STATES = {
  room: {
    free: ROOM_FREE,
    occupied: ROOM_OCCUPIED,
    off: ROOM_OFF,
    // Mismos estados con los valores de ROOM_STATUS (los que devuelve la API).
    FREE: ROOM_FREE,
    OCCUPIED: ROOM_OCCUPIED,
    UNAVAILABLE: ROOM_OFF,
  },
  booking: {
    PENDING_PAYMENT: { label: 'Pendiente de pago', className: styles.pending },
    CONFIRMED: { label: 'Confirmada', className: styles.free },
    CANCELLED: { label: 'Cancelada', className: styles.occupied },
    EXPIRED: { label: 'Caducada', className: styles.neutral },
    COMPLETED: { label: 'Completada', className: styles.neutral },
    // BOOKING_DISPLAY_STATUS: estados que calcula la pantalla.
    CANCELLED_BY_CLIENT: { label: 'Cancelada por ti', className: styles.danger },
    CANCELLED_BY_SPACE: {
      label: 'Cancelada por el espacio · Reembolsada',
      className: styles.danger,
    },
    REFUND_PENDING: { label: 'Reembolso en curso', className: styles.pending },
    BLOCKED: { label: 'Bloqueada', className: styles.neutral },
  },
  company: {
    verified: { label: 'Verificada', className: styles.free },
    pending: { label: 'Pendiente', className: styles.pending },
    rejected: { label: 'Rechazada', className: styles.danger },
    suspended: { label: 'Suspendida', className: styles.danger },
  },
  roomListing: {
    PUBLISHED: { label: 'Publicada', className: styles.free },
    NO_PRICE: { label: 'Sin precio', className: styles.pending },
    HIDDEN: { label: 'Oculta', className: styles.neutral },
    COMMON: { label: 'Zona común', className: styles.neutral },
  },
  publish: {
    PUBLISHED: { label: 'Publicado', className: styles.free },
    DRAFT: { label: 'Borrador', className: styles.pending },
  },
  payment: {
    PENDING: { label: 'Pendiente', className: styles.pending },
    FAILED: { label: 'Fallido', className: styles.danger },
    SUCCEEDED: { label: 'Pagado', className: styles.free },
    REFUNDED: { label: 'Reembolsado', className: styles.neutral },
  },
  payoutAccount: {
    NOT_CONNECTED: { label: 'Sin conectar', className: styles.neutral },
    PENDING_VERIFICATION: { label: 'Pendiente de verificación', className: styles.pending },
    ACTIVE: { label: 'Activa', className: styles.free },
    RESTRICTED: { label: 'Restringida', className: styles.danger },
  },
};

export default function StatusBadge({ status, kind = 'room' }) {
  const state = STATES[kind]?.[status];
  if (!state) return null;
  return <span className={`${styles.badge} ${state.className}`}>{state.label}</span>;
}
