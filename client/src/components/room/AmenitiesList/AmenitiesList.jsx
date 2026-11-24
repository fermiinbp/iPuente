// Equipamiento de la sala: lista con una marca y el texto (con tildes: «Climatización», no «Climatizacion»).
import { AMENITIES } from '@/utils/roomData.js';
import styles from './AmenitiesList.module.css';

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const label = (item) => AMENITIES.find((a) => a.value === item)?.label ?? capitalize(item);

export default function AmenitiesList({ items }) {
  if (!items?.length) {
    return <p className={styles.empty}>La empresa no ha indicado el equipamiento de esta sala.</p>;
  }
  return (
    <ul className={styles.list} aria-label="Equipamiento">
      {items.map((item) => (
        <li key={item} className={styles.item}>
          <span className={styles.mark} aria-hidden="true" />
          {label(item)}
        </li>
      ))}
    </ul>
  );
}
