// Etiqueta de estado de una sala: siempre con texto; «No se alquila» además lleva trama diagonal.
import styles from './StatusBadge.module.css';

const STATES = {
  free: { label: 'Libre', className: styles.free },
  occupied: { label: 'Ocupada', className: styles.occupied },
  off: { label: 'No se alquila', className: styles.off },
};

export default function StatusBadge({ status }) {
  const state = STATES[status];
  if (!state) return null;
  return <span className={`${styles.badge} ${state.className}`}>{state.label}</span>;
}
