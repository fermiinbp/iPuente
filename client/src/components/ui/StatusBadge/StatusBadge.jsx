// Etiqueta de estado, siempre con texto. `kind`: 'room' (por defecto), 'booking' o 'company'.
// «No se alquila» además lleva trama diagonal.
import styles from './StatusBadge.module.css';

const STATES = {
  room: {
    free: { label: 'Libre', className: styles.free },
    occupied: { label: 'Ocupada', className: styles.occupied },
    off: { label: 'No se alquila', className: styles.off },
  },
  booking: {
    PENDING_PAYMENT: { label: 'Pendiente de pago', className: styles.pending },
    CONFIRMED: { label: 'Confirmada', className: styles.free },
    CANCELLED: { label: 'Cancelada', className: styles.occupied },
    EXPIRED: { label: 'Caducada', className: styles.neutral },
    COMPLETED: { label: 'Completada', className: styles.neutral },
  },
  company: {
    verified: { label: 'Verificada', className: styles.free },
    pending: { label: 'Pendiente', className: styles.pending },
  },
};

export default function StatusBadge({ status, kind = 'room' }) {
  const state = STATES[kind]?.[status];
  if (!state) return null;
  return <span className={`${styles.badge} ${state.className}`}>{state.label}</span>;
}
