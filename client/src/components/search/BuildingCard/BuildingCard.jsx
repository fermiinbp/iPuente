// Tarjeta de edificio en los resultados: dirección, ciudad y número de plantas. Toda ella es un enlace al edificio.
import { Link } from 'react-router';
import symbol from '@/assets/images/ipuente-simbolo.svg';
import styles from './BuildingCard.module.css';

export default function BuildingCard({ building, date }) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const place = [building.direccion, building.ciudad].filter(Boolean).join(', ');

  return (
    <Link className={styles.card} to={`/buildings/${building.id}${query}`}>
      <span className={styles.photo} aria-hidden="true">
        <img className={styles.symbol} src={symbol} alt="" />
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{building.nombre}</span>
        {place && <span className={styles.place}>{place}</span>}
        {building.descripcion && <span className={styles.text}>{building.descripcion}</span>}
        <span className={styles.meta}>
          {building.numPlantas
            ? `${building.numPlantas} ${building.numPlantas === 1 ? 'planta' : 'plantas'}`
            : 'Ver plantas'}
          <span aria-hidden="true"> →</span>
        </span>
      </span>
    </Link>
  );
}
