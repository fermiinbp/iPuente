// Pin de un lugar cercano sobre el mapa: número siempre visible y, si está activo, también su nombre.
// Es decorativo para lectores de pantalla (aria-hidden): la lista de la sección es el equivalente accesible.
// El lugar principal (`poi.principal`) se dibuja más grande y con un aro, y en la lista lleva el texto «Principal».
import { Marker } from 'react-map-gl/maplibre';
import styles from './PoiMarker.module.css';

export default function PoiMarker({ poi, number, active, highlighted, onSelect, onHover }) {
  const clase = active ? styles.pinActive : highlighted ? styles.pinHover : styles.pin;
  return (
    <Marker
      longitude={poi.lng}
      latitude={poi.lat}
      anchor="bottom"
      style={{ zIndex: active || highlighted ? 2 : 1 }}
    >
      <div
        aria-hidden="true"
        className={poi.principal ? `${clase} ${styles.principal}` : clase}
        onClick={() => onSelect(poi)}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') onHover(poi.id);
        }}
        onPointerLeave={() => onHover(null)}
      >
        <span className={styles.number}>{number}</span>
        {active && <span className={styles.name}>{poi.nombre}</span>}
      </div>
    </Marker>
  );
}
