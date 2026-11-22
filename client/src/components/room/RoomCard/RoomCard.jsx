// Tarjeta resumen de una sala (tipo, nombre, lugar, capacidad y precio). Toda la tarjeta es un enlace a la ficha.
import { Link } from 'react-router';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './RoomCard.module.css';

// variant: 'default' (tarjeta vertical), 'featured' (grande, con la sala protagonista) o 'compact' (en fila).
const VARIANT_CLASS = { featured: styles.featured, compact: styles.compact };

export default function RoomCard({ room, variant = 'default' }) {
  return (
    <Link className={`${styles.card} ${VARIANT_CLASS[variant] ?? ''}`} to={`/rooms/${room.id}`}>
      {/* Sin foto, la tarjeta enseña el tipo de sala en grande: es información, no un hueco gris. */}
      <span className={styles.photo} aria-hidden="true">
        <span className={styles.type}>{room.type}</span>
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{room.name}</span>
        <span className={styles.place}>{room.place}</span>
        <span className={styles.meta}>
          <span>hasta {room.people} personas</span>
          <span>{priceLabel(room.price, { gratis: room.gratis, perHour: true })}</span>
        </span>
      </span>
    </Link>
  );
}
