// Tarjeta de edificio en los resultados: foto, nombre, dirección, «desde X €/h» y salas libres.
// Toda ella es un enlace al edificio, que recibe la fecha y las personas elegidas en la URL.
import { Link } from 'react-router';
import symbol from '@/assets/images/ipuente-simbolo.svg';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './BuildingCard.module.css';

export default function BuildingCard({ building, date = '', people = '' }) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (people) params.set('people', people);
  const query = params.toString();
  const place = [building.direccion, building.ciudad].filter(Boolean).join(', ');
  const free = building.salasDisponibles;

  let freeText = '';
  if (typeof free === 'number') {
    freeText = `${free} ${free === 1 ? 'sala libre' : 'salas libres'}`;
    if (people) freeText += ` para ${people} ${Number(people) === 1 ? 'persona' : 'personas'}`;
  }

  return (
    <Link className={styles.card} to={`/buildings/${building.id}${query ? `?${query}` : ''}`}>
      <span className={styles.photo}>
        {building.foto ? (
          <img className={styles.image} src={building.foto} alt="" loading="lazy" />
        ) : (
          <img className={styles.symbol} src={symbol} alt="" />
        )}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{building.nombre}</span>
        {place && <span className={styles.place}>{place}</span>}
        {typeof building.precioDesde === 'number' && (
          <span className={styles.price}>desde {formatPrice(building.precioDesde)}/h</span>
        )}
        {freeText && <span className={styles.free}>{freeText}</span>}
        <span className={styles.meta}>
          Ver edificio<span aria-hidden="true"> →</span>
        </span>
      </span>
    </Link>
  );
}
