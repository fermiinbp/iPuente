// Estampa de una sala: botón con su nombre, precio, capacidad y estado escrito. El estado nunca va solo en color:
// lleva texto y símbolo, y además el trazo del borde (continuo: libre; grueso: ocupada; discontinuo con trama:
// no se alquila). Al pulsarla avisa con `onOpen(room.id)`. La aparición (`--k`, de 0 a 1) la escribe quien la contiene.
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './RoomStamp.module.css';

const STATUS_TEXT = { free: 'Libre', occupied: 'Ocupada', off: 'No se alquila' };
const STATUS_GLYPH = { free: '✓', occupied: '✕', off: '⊘' };
const STATUS_CLASS = { free: styles.libre, occupied: styles.ocupada, off: styles.noAlquila };

// `compact` quita la línea de capacidad (sobre el edificio hay poco sitio); en la ficha sí aparece.
export default function RoomStamp({ room, onOpen, compact = false, className = '' }) {
  const classes = [
    styles.estampa,
    STATUS_CLASS[room.status],
    compact ? styles.compacta : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      aria-haspopup="dialog"
      onClick={() => onOpen?.(room.id)}
    >
      <span className={styles.nombre}>{room.name}</span>
      <span className={styles.precio}>
        {room.status === 'off' ? '—' : priceLabel(room.price, { perHour: true })}
      </span>
      <span className={styles.datos}>{room.people} personas</span>
      <span className={styles.estado}>
        <span aria-hidden="true">{STATUS_GLYPH[room.status]}</span> {STATUS_TEXT[room.status]}
      </span>
    </button>
  );
}
