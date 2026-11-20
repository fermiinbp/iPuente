// Mapa de resultados (extra CLI016): un pin por edificio con su latitud y longitud (MapLibre + OpenFreeMap, sin API key).
// Pasar el ratón o el foco por una tarjeta resalta su pin, y al revés. Los pins son decorativos: la lista de
// tarjetas es la alternativa accesible. Se importa con React.lazy desde la página de búsqueda.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker } from 'react-map-gl/maplibre';
import { loadBosqueStyle } from '@/components/building/NearbyMap/mapStyle.js';
import styles from './SearchMap.module.css';

const REDUCED = '(prefers-reduced-motion: reduce)';
const MAX_ZOOM = 15;

function hasPosition(building) {
  return Number.isFinite(building.latitud) && Number.isFinite(building.longitud);
}

export default function SearchMap({ buildings, activeId, onActivate, onUnavailable }) {
  const mapRef = useRef(null);
  const [style, setStyle] = useState(null);
  const pins = useMemo(() => buildings.filter(hasPosition), [buildings]);
  // Cambia solo si cambian los edificios mostrados: así el encuadre no se repite sin motivo.
  const pinsKey = pins.map((pin) => pin.id).join('|');

  useEffect(() => {
    let alive = true;
    loadBosqueStyle()
      .then((loaded) => alive && setStyle(loaded))
      .catch(() => alive && onUnavailable?.());
    return () => {
      alive = false;
    };
  }, [onUnavailable]);

  // Encuadra todos los pins al cargar y cada vez que cambian los resultados.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pins.length === 0) return;
    const duration = window.matchMedia(REDUCED).matches ? 0 : 600;
    if (pins.length === 1) {
      map.easeTo({ center: [pins[0].longitud, pins[0].latitud], zoom: 14, duration });
      return;
    }
    const lngs = pins.map((pin) => pin.longitud);
    const lats = pins.map((pin) => pin.latitud);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: MAX_ZOOM, duration },
    );
    // pinsKey resume qué edificios hay; pins cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, style]);

  if (!style || pins.length === 0) return <div className={styles.map} aria-hidden="true" />;

  const first = pins[0];
  return (
    <div className={styles.map}>
      <MapGL
        ref={mapRef}
        mapStyle={style}
        initialViewState={{ longitude: first.longitud, latitude: first.latitud, zoom: 13 }}
        cooperativeGestures
        attributionControl={{ compact: true }}
        onLoad={() => mapRef.current && mapRef.current.resize()}
      >
        {pins.map((pin) => {
          const active = pin.id === activeId;
          return (
            <Marker
              key={pin.id}
              longitude={pin.longitud}
              latitude={pin.latitud}
              anchor="bottom"
              style={{ zIndex: active ? 2 : 1 }}
            >
              <span
                className={styles.pinWrap}
                aria-hidden="true"
                onMouseEnter={() => onActivate?.(pin.id)}
                onMouseLeave={() => onActivate?.(null)}
              >
                <span className={`${styles.pin} ${active ? styles.pinActive : ''}`} />
                {active && <span className={styles.pinName}>{pin.nombre}</span>}
              </span>
            </Marker>
          );
        })}
      </MapGL>
    </div>
  );
}
