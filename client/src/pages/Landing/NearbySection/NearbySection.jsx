// Sección «Alrededor del edificio»: mapa 3D con los puntos cercanos y lista accesible con sus tiempos.
// Sin WebGL, la lista y el detalle bastan. Three.js se carga en diferido.
import { lazy, Suspense, useState } from 'react';
import ErrorBoundary from '@/components/three/ErrorBoundary/ErrorBoundary.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { NEARBY_BUILDING, NEARBY_PLACES } from '../nearbyData.js';
import styles from './NearbySection.module.css';

// LazyCanvas importa @react-three/fiber: se carga en diferido para que Three.js no entre en la carga inicial.
const LazyCanvas = lazy(() => import('@/components/three/LazyCanvas/LazyCanvas.jsx'));
const NearbyMap = lazy(() => import('@/components/building/NearbyMap/NearbyMap.jsx'));

const CAMERA = { position: [0, 0, 24], fov: 30 };

export default function NearbySection() {
  const [activeId, setActiveId] = useState(NEARBY_PLACES[0].id);
  const [announcement, setAnnouncement] = useState('');
  const active = NEARBY_PLACES.find((place) => place.id === activeId) ?? NEARBY_PLACES[0];

  const choose = (place) => {
    setActiveId(place.id);
    setAnnouncement(`${place.name}: ${place.time}. ${place.detail}`);
  };

  const sinMapa = (
    <p className={styles.note} role="note">
      No se puede mostrar el mapa en 3D en este dispositivo. Tienes la lista de lugares cercanos y
      sus tiempos justo al lado.
    </p>
  );

  return (
    <Section
      id="alrededor"
      titleId="alrededor-titulo"
      tone="elevated"
      spacious
      innerClassName={styles.inner}
    >
      <div className={styles.mapBox}>
        <ErrorBoundary fallback={sinMapa}>
          <Suspense fallback={<p className={styles.note}>Cargando el mapa…</p>}>
            <LazyCanvas
              lazy
              label={`Mapa en 3D de ${NEARBY_BUILDING.name} y los lugares cercanos`}
              camera={CAMERA}
              className={styles.map}
              fallback={sinMapa}
            >
              <Suspense fallback={null}>
                <NearbyMap building={NEARBY_BUILDING} places={NEARBY_PLACES} activeId={active.id} />
              </Suspense>
            </LazyCanvas>
          </Suspense>
        </ErrorBoundary>
      </div>

      <div className={styles.info}>
        <SectionTitle id="alrededor-titulo">Alrededor del edificio</SectionTitle>
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
                onClick={() => choose(place)}
                onPointerEnter={(event) => {
                  // Solo con ratón: en táctil el hover emulado no debe cambiar la selección.
                  if (event.pointerType === 'mouse') setActiveId(place.id);
                }}
              >
                <span className={styles.name}>{place.name}</span>
                <span className={styles.time}>{place.time}</span>
              </button>
            );
          })}
        </div>

        {/* Solo se anuncia lo elegido con clic o teclado, no el paso del ratón. */}
        <p className={styles.srOnly} aria-live="polite">
          {announcement}
        </p>
        <div className={styles.detail}>
          <p className={styles.detailTitle}>{active.name}</p>
          <p className={styles.detailText}>
            {active.time}. {active.detail}
          </p>
        </div>
      </div>
    </Section>
  );
}
