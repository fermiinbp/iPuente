// Tarjeta resumen de una sala (foto, nombre, lugar, capacidad y precio). Toda la tarjeta es un enlace a la ficha.
import { Link } from 'react-router';
import styles from './RoomCard.module.css';

export default function RoomCard({ room }) {
  return (
    <Link className={styles.card} to={`/rooms/${room.id}`}>
      <span className={styles.photo} aria-hidden="true" />
      <span className={styles.body}>
        <span className={styles.name}>{room.name}</span>
        <span className={styles.place}>{room.place}</span>
        <span className={styles.meta}>
          <span>{room.people} personas</span>
          <span>{room.price} €/h</span>
        </span>
      </span>
    </Link>
  );
}
