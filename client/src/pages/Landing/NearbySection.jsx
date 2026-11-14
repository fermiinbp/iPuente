// Sección «Alrededor del edificio»: mapa 3D con los puntos cercanos y lista accesible con sus tiempos.
// Sin WebGL, la lista y el detalle bastan. Three.js se carga en diferido.
import { lazy, Suspense, useState } from 'react';
import { NEARBY_BUILDING, NEARBY_PLACES } from './nearbyData.js';
import styles from './NearbySection.module.css';

// LazyCanvas importa @react-three/fiber: se carga en diferido para que Three.js no entre en la carga inicial.
const LazyCanvas = lazy(() => import('@/components/three/LazyCanvas/LazyCanvas.jsx'));
const NearbyMap = lazy(() => import('@/components/building/NearbyMap/NearbyMap.jsx'));

const CAMERA = { position: [0, 0, 24], fov: 30 };

export default function NearbySection() {
  const [activeId, setActiveId] = useState(NEARBY_PLACES[0].id);
  const active = NEARBY_PLACES.find((place) => place.id === activeId) ?? NEARBY_PLACES[0];

  return (
    <section className={styles.section} id="alrededor" aria-labelledby="alrededor-titulo">
      <div className={styles.inner}>
        <div className={styles.mapBox}>
          <Suspense fallback={<p className={styles.note}>Cargando el mapa…</p>}>
            <LazyCanvas
              lazy
              label={`Mapa en 3D de ${NEARBY_BUILDING.name} y los lugares cercanos`}
              camera={CAMERA}
              className={styles.map}
              fallback={
                <p className={styles.note}>
                  No se puede mostrar el mapa en 3D en este dispositivo. Tienes la lista de lugares
                  cercanos y sus tiempos justo al lado.
                </p>
              }
            >
              <Suspense fallback={null}>
                <NearbyMap building={NEARBY_BUILDING} places={NEARBY_PLACES} activeId={active.id} />
              </Suspense>
            </LazyCanvas>
          </Suspense>
        </div>

        <div className={styles.info}>
          <h2 className={styles.title} id="alrededor-titulo">
            Alrededor del edificio
          </h2>
          <p className={styles.lead}>
            Cuánto se tarda en llegar desde cada punto, para que tus invitados lleguen a tiempo.
          </p>

          <div className={styles.list} role="group" aria-label="Lugares cercanos">
            {NEARBY_PLACES.map((place) => {
              const pressed = place.id === active.id;
              return (
                <button
                  key={place.id}
                  type="button"
                  className={pressed ? styles.itemActive : styles.item}
                  aria-pressed={pressed}
                  onClick={() => setActiveId(place.id)}
                  onMouseEnter={() => setActiveId(place.id)}
                  onFocus={() => setActiveId(place.id)}
                >
                  <span className={styles.name}>{place.name}</span>
                  <span className={styles.time}>{place.time}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.detail} aria-live="polite">
            <p className={styles.detailTitle}>{active.name}</p>
            <p className={styles.detailText}>
              {active.time}. {active.detail}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
