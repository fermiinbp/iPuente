// Leyenda del hero en escritorio: dice qué planta está abierta en el 3D mientras se baja (nombre, salas libres y enlace
// a su plano). Se pinta en el hueco de la «carrera» del hero (HeroStory la lleva allí con un portal); en móvil y con
// prefers-reduced-motion ese hueco no existe y la leyenda queda oculta. Sin planta abierta no pinta nada.
import { Link } from 'react-router';
import styles from './HeroFloorNote.module.css';

export default function HeroFloorNote({ buildingId, floor }) {
  if (!floor) return null;
  return (
    // `key` repite la entrada suave cada vez que cambia la planta.
    <div className={styles.note} key={floor.id}>
      <p className={styles.name}>{floor.name}</p>
      <p className={styles.free}>
        {floor.free === 1 ? '1 sala libre' : `${floor.free} salas libres`} hoy
      </p>
      <Link className={styles.link} to={`/buildings/${buildingId}/floors/${floor.id}`}>
        Ver el plano de la planta {floor.number}
      </Link>
    </div>
  );
}
