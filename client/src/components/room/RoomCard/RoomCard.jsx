// Tarjeta resumen de una sala (tipo, nombre, lugar, capacidad, precio y llamada a la ficha). Toda la tarjeta es un enlace.
// Es una tarjeta clara con su propio fondo: se lee igual sobre superficies claras u oscuras.
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
          <span className={styles.people}>hasta {room.people} personas</span>
          <span className={styles.price}>
            {priceLabel(room.price, { gratis: room.gratis, perHour: true })}
          </span>
        </span>
        <span className={styles.cta} aria-hidden="true">
          Ver sala y reservar <span className={styles.arrow}>→</span>
        </span>
      </span>
    </Link>
  );
}
