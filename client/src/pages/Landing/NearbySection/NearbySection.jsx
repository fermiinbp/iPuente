// Sección «Alrededor del edificio»: mapa vectorial con los lugares cercanos y lista accesible con sus tiempos.
// Sin mapa (sin WebGL o sin red), la lista y el detalle bastan. MapLibre se carga en diferido.
import { lazy, Suspense, useCallback, useState } from 'react';
import { useNearViewport } from '@/hooks/useNearViewport.js';
import ErrorBoundary from '@/components/three/ErrorBoundary/ErrorBoundary.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import styles from './NearbySection.module.css';

const NearbyMap = lazy(() => import('@/components/building/NearbyMap/NearbyMap.jsx'));

function tiempos(poi) {
  const partes = [];
  if (poi.minPie) partes.push(`${poi.minPie} min a pie`);
  if (poi.minCoche) partes.push(`${poi.minCoche} min en coche`);
  return partes.join(' · ');
}

// `edificio`: { nombre, latitud, longitud, huella?, altura? } (ver NearbyMap). `pois`: lugares cercanos
// [{ id, nombre, minPie, minCoche?, descripcion, lat, lng, ruta }]. Sin lugares (o sin coordenadas del
// edificio) la sección no se muestra.
// `tone` es el fondo de la sección: 'elevated' (verde, por defecto) o 'crema' (banda clara con el texto en bosque).
export default function NearbySection({ edificio, pois = [], tone = 'elevated' }) {
  const [activeId, setActiveId] = useState(null); // elegido con clic o Enter: mueve la cámara
  const [hoverId, setHoverId] = useState(null); // ratón o foco: solo resalta
  const [announcement, setAnnouncement] = useState('');
  // El mapa (MapLibre, unos 300 kB) solo se descarga cuando la sección se acerca a la pantalla.
  const [mapRef, mapNear] = useNearViewport();
  const [mapaFallido, setMapaFallido] = useState(false);
  const active = pois.find((poi) => poi.id === activeId) ?? null;

  const choose = (poi) => {
    setActiveId(poi.id);
    setAnnouncement(`${poi.nombre}: ${tiempos(poi)}. ${poi.descripcion}`);
  };
  const reset = () => {
    setActiveId(null);
    setAnnouncement('Mapa centrado en el edificio.');
  };
  const onUnavailable = useCallback(() => setMapaFallido(true), []);

  // Los hooks ya se han llamado: con esto, un edificio sin lugares cercanos no enseña la sección.
  const sinUbicacion = !Number.isFinite(edificio?.latitud) || !Number.isFinite(edificio?.longitud);
  if (pois.length === 0 || sinUbicacion) return null;

  const sinMapa = (
    <p className={styles.note} role="note">
      No se puede mostrar el mapa en este dispositivo. Tienes la lista de lugares cercanos y sus
      tiempos justo al lado.
    </p>
  );

  return (
    <Section
      id="alrededor"
      titleId="alrededor-titulo"
      tone={tone}
      spacious
      className={tone === 'crema' ? styles.light : ''}
      innerClassName={styles.inner}
    >
      <div className={styles.mapBox} ref={mapRef}>
        {mapaFallido ? (
          sinMapa
        ) : (
          <ErrorBoundary fallback={sinMapa}>
            <Suspense fallback={<p className={styles.note}>Cargando el mapa…</p>}>
              {mapNear ? (
                <NearbyMap
                  edificio={edificio}
                  pois={pois}
                  activeId={activeId}
                  hoverId={hoverId}
                  onSelect={choose}
                  onHover={setHoverId}
                  onReset={reset}
                  onUnavailable={onUnavailable}
                />
              ) : (
                <p className={styles.note}>Cargando el mapa…</p>
              )}
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      <div className={styles.info}>
        <SectionTitle id="alrededor-titulo">Alrededor del edificio</SectionTitle>
        <p className={styles.lead}>
          Cuánto se tarda en llegar desde cada punto, para que tus invitados lleguen a tiempo.
        </p>

        <div className={styles.list} role="group" aria-label="Lugares cercanos">
          {pois.map((poi, i) => {
            const pressed = poi.id === activeId;
            const resaltado = !pressed && poi.id === hoverId;
            return (
              <button
                key={poi.id}
                type="button"
                className={pressed ? styles.itemActive : resaltado ? styles.itemHover : styles.item}
                aria-pressed={pressed}
                onClick={() => choose(poi)}
                onFocus={() => setHoverId(poi.id)}
                onBlur={() => setHoverId(null)}
                onPointerEnter={(event) => {
                  // Solo con ratón: en táctil el hover emulado no debe resaltar nada.
                  if (event.pointerType === 'mouse') setHoverId(poi.id);
                }}
                onPointerLeave={() => setHoverId(null)}
              >
                <span className={styles.number} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.name}>{poi.nombre}</span>
                <span className={styles.time}>{tiempos(poi)}</span>
              </button>
            );
          })}
        </div>

        {/* Solo se anuncia lo elegido con clic o teclado, no el paso del ratón. */}
        <p className={styles.srOnly} aria-live="polite">
          {announcement}
        </p>
        <div className={styles.detail}>
          {active ? (
            <>
              <p className={styles.detailTitle}>{active.nombre}</p>
              <p className={styles.detailText}>
                {tiempos(active)}. {active.descripcion}
              </p>
            </>
          ) : (
            <p className={styles.detailText}>
              Elige un lugar de la lista para ver el recorrido desde el edificio.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
