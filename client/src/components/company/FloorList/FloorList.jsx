// Plantas de un edificio en el panel de empresa (wireframe 12): una tarjeta por planta con su nombre, su estado y
// sus salas, el enlace «Editar mapa →» a su editor y, al final, la tarjeta «+ Añadir planta».
// No confundir con `components/building/FloorList`, la lista de plantas que ve el cliente.
// `floors`: [{ id, numero, nombre, publicado, salas }] en el orden de la API (de la más baja a la más alta).
// `buildingName` completa los nombres accesibles («Editar mapa de Planta 1, Torre Cartuja»).
import { Link } from 'react-router';
import styles from './FloorList.module.css';

function floorState({ publicado, salas }) {
  const state = publicado ? 'Publicada' : 'Borrador';
  if (salas === 0) return `${state} · sin salas`;
  return `${state} · ${salas} ${salas === 1 ? 'sala' : 'salas'}`;
}

export default function FloorList({ floors = [], buildingName, onAddFloor }) {
  return (
    <ul className={styles.floorList}>
      {floors.map((floor) => (
        <li key={floor.id} className={styles.floor}>
          <div className={styles.info}>
            <p className={styles.name}>{floor.nombre}</p>
            <p className={styles.state}>{floorState(floor)}</p>
          </div>
          <Link className={styles.editLink} to={`/company/floors/${floor.id}/editor`}>
            Editar mapa <span aria-hidden="true">→</span>
            <span className={styles.srOnly}>
              {' '}
              de {floor.nombre}, {buildingName}
            </span>
          </Link>
        </li>
      ))}
      <li className={styles.addItem}>
        <button type="button" className={styles.add} onClick={onAddFloor}>
          <span aria-hidden="true">+ </span>Añadir planta
          <span className={styles.srOnly}> a {buildingName}</span>
        </button>
      </li>
    </ul>
  );
}
