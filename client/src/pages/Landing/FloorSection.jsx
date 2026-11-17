// Sección «Planta 2»: lista de salas, detalle de la seleccionada y plano 3D donde la sala elegida se eleva.
import { lazy, Suspense, useState } from 'react';
import { hasWebGL } from '@/utils/webgl.js';
import ErrorBoundary from '@/components/three/ErrorBoundary/ErrorBoundary.jsx';
import Legend from '@/components/floor-plan/Legend/Legend.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { FLOOR_CAMERA, FLOOR_PLAN, STATUS_LABELS } from './floorPlanData.js';
import styles from './FloorSection.module.css';

// Three.js va en un trozo aparte que no pesa en el archivo principal. El hero lo pide al cargar la página y estas
// secciones comparten ese mismo trozo; lo que `lazy` retrasa en LazyCanvas es montar el <canvas> hasta que se acerca.
const LazyCanvas = lazy(() => import('@/components/three/LazyCanvas/LazyCanvas.jsx'));
const FloorPlan = lazy(() => import('@/components/floor-plan/FloorPlan/FloorPlan.jsx'));

const STATUS_CLASS = { free: styles.free, occupied: styles.occupied, off: styles.off };

function detailText(room) {
  if (room.status === 'off') {
    return `Esta sala aparece en el plano, pero no se alquila. ${room.area} m², hasta ${room.people} personas.`;
  }
  const base = `${room.area} m² · hasta ${room.people} personas · ${room.price} €/hora.`;
  if (room.status === 'occupied') return `${base} Ocupada ahora: mira los huecos libres de hoy.`;
  return `${base} Equipamiento: ${room.equipment.join(', ')}.`;
}

export default function FloorSection() {
  const [selectedId, setSelectedId] = useState(null);
  const webgl = hasWebGL();
  const { rooms } = FLOOR_PLAN;
  const selected = rooms.find((room) => room.id === selectedId) ?? null;
  const freeCount = rooms.filter((room) => room.status === 'free').length;

  const sinPlano = (
    <p className={styles.note} role="note">
      Tu navegador no puede mostrar el plano en 3D. Usa la lista de salas y su leyenda para
      consultar el estado de cada una.
    </p>
  );

  const toggle = (id) => setSelectedId((actual) => (actual === id ? null : id));

  return (
    <Section id="planta" titleId="planta-titulo" tone="deep" spacious innerClassName={styles.inner}>
      <div className={styles.info}>
        <SectionTitle id="planta-titulo">{FLOOR_PLAN.name}</SectionTitle>
        <p className={styles.summary}>
          {freeCount} de {rooms.length} salas libres hoy. Elige una sala para verla en el plano.
        </p>

        <div role="group" aria-label="Salas de la planta" className={styles.list}>
          {rooms.map((room) => {
            const active = room.id === selectedId;
            return (
              <button
                key={room.id}
                type="button"
                className={`${styles.room} ${active ? styles.roomActive : ''}`}
                aria-pressed={active}
                onClick={() => toggle(room.id)}
              >
                <span className={styles.bar} aria-hidden="true" />
                <span className={styles.roomName}>{room.name}</span>
                <span className={styles.roomStatus}>
                  <span
                    className={`${styles.swatch} ${STATUS_CLASS[room.status]}`}
                    aria-hidden="true"
                  />
                  {STATUS_LABELS[room.status]}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.detail} aria-live="polite">
          {selected ? (
            <>
              <p className={styles.detailTitle}>
                {selected.name} · {STATUS_LABELS[selected.status]}
              </p>
              <p className={styles.detailText}>{detailText(selected)}</p>
              <button type="button" className={styles.clear} onClick={() => setSelectedId(null)}>
                Quitar selección
              </button>
            </>
          ) : (
            <p className={styles.detailText}>Ninguna sala seleccionada.</p>
          )}
        </div>

        <Legend className={styles.legend} />
      </div>

      <div className={styles.stage}>
        {webgl ? (
          <ErrorBoundary fallback={sinPlano}>
            <Suspense fallback={<p className={styles.note}>Cargando el plano…</p>}>
              <LazyCanvas
                lazy
                label="Plano 3D de la Planta 2 con seis salas. Usa la lista de salas para elegir una."
                camera={FLOOR_CAMERA}
                className={styles.canvas}
              >
                <FloorPlan plan={FLOOR_PLAN} selectedId={selectedId} onSelect={setSelectedId} />
              </LazyCanvas>
            </Suspense>
          </ErrorBoundary>
        ) : (
          sinPlano
        )}
      </div>
    </Section>
  );
}
