// Plantas de un edificio de la más alta a la más baja, como un edificio visto de lado.
// Cada una enlaza a su plano y dice cuántas salas libres tiene en la fecha elegida.
import { Link } from 'react-router';
import styles from './FloorList.module.css';

function freeLabel(count) {
  if (count === 0) return 'Sin salas libres';
  return count === 1 ? '1 sala libre' : `${count} salas libres`;
}

export default function FloorList({ buildingId, floors, fecha }) {
  const ordered = [...floors].sort((a, b) => b.nivel - a.nivel);
  const query = fecha ? `?date=${encodeURIComponent(fecha)}` : '';

  if (ordered.length === 0) {
    return <p className={styles.empty}>Este edificio todavía no tiene plantas publicadas.</p>;
  }

  return (
    <ol className={styles.list} aria-label="Plantas del edificio">
      {ordered.map((floor, index) => {
        const full = floor.salasLibres === 0;
        return (
          <li key={floor.id} className={styles.item} style={{ '--i': index }}>
            <Link
              className={`${styles.link} ${full ? styles.full : ''}`}
              to={`/buildings/${buildingId}/floors/${floor.id}${query}`}
            >
              <span className={styles.level} aria-hidden="true">
                {floor.nivel === 0 ? 'PB' : floor.nivel}
              </span>
              <span className={styles.name}>{floor.nombre}</span>
              <span className={styles.free}>
                <span className={styles.dot} aria-hidden="true" />
                {freeLabel(floor.salasLibres)}
              </span>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
