// Sección «Planta 2»: lista de salas, detalle de la seleccionada y plano 3D donde la sala elegida se eleva.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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

// Las salas ocupadas empiezan con la luz encendida (hay gente dentro); las libres, a oscuras.
const INITIAL_LIT = FLOOR_PLAN.rooms.filter((r) => r.status === 'occupied').map((r) => r.id);
const LIGHTABLE = FLOOR_PLAN.rooms.filter((r) => r.status !== 'off').map((r) => r.id);
const FREE_IDS = FLOOR_PLAN.rooms.filter((r) => r.status === 'free').map((r) => r.id);
const CELEBRATE_MS = 2600;

export default function FloorSection() {
  const [selectedId, setSelectedId] = useState(null);
  const [litIds, setLitIds] = useState(INITIAL_LIT);
  const [celebrating, setCelebrating] = useState(false);
  const wasComplete = useRef(false);
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

  // Un clic en una sala la selecciona y enciende su luz; otro clic la deselecciona y la apaga.
  // La sala que no se alquila se selecciona (para ver su detalle) pero no se ilumina.
  function pressRoom(id) {
    if (id === null) {
      setSelectedId(null);
      return;
    }
    const wasSelected = selectedId === id;
    setSelectedId(wasSelected ? null : id);
    if (!LIGHTABLE.includes(id)) return;
    setLitIds((actual) => {
      const lit = actual.includes(id);
      if (wasSelected) return lit ? actual.filter((x) => x !== id) : actual;
      return lit ? actual : [...actual, id];
    });
  }

  // Juego: encender las salas libres. Al completarlas todas, mensaje y destello (una vez por vez).
  const freeLit = FREE_IDS.filter((id) => litIds.includes(id)).length;
  const complete = freeLit === FREE_IDS.length;
  useEffect(() => {
    if (complete && !wasComplete.current) {
      wasComplete.current = true;
      const start = setTimeout(() => setCelebrating(true), 0);
      const end = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
      return () => {
        clearTimeout(start);
        clearTimeout(end);
      };
    }
    if (!complete) wasComplete.current = false;
    return undefined;
  }, [complete]);

  return (
    <Section id="planta" titleId="planta-titulo" tone="deep" spacious innerClassName={styles.inner}>
      <div className={styles.info}>
        <SectionTitle id="planta-titulo">{FLOOR_PLAN.name}</SectionTitle>
        <p className={styles.summary}>
          {freeCount} de {rooms.length} salas libres hoy. Pulsa una sala para verla en el plano y
          encender su luz.
        </p>

        <p className={styles.lightsScore}>
          Luces de las salas libres:{' '}
          <strong>
            {freeLit} de {FREE_IDS.length}
          </strong>
        </p>
        <p
          className={`${styles.celebration} ${celebrating ? styles.celebrationOn : ''}`}
          role="status"
        >
          {celebrating
            ? `¡Planta iluminada! Las ${FREE_IDS.length} salas libres están listas para reservar.`
            : ''}
        </p>

        <div role="group" aria-label="Salas de la planta" className={styles.list}>
          {rooms.map((room) => {
            const active = room.id === selectedId;
            return (
              <div key={room.id} className={styles.row}>
                <button
                  type="button"
                  className={`${styles.room} ${active ? styles.roomActive : ''}`}
                  aria-pressed={active}
                  onClick={() => pressRoom(room.id)}
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
              </div>
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

      <div className={`${styles.stage} ${celebrating ? styles.stageFlash : ''}`}>
        {webgl ? (
          <ErrorBoundary fallback={sinPlano}>
            <Suspense fallback={<p className={styles.note}>Cargando el plano…</p>}>
              <LazyCanvas
                lazy
                label="Plano 3D de la Planta 2 con seis salas y sus luces. Pulsa una sala, en el plano o en la lista, para seleccionarla y encender su luz."
                camera={FLOOR_CAMERA}
                className={styles.canvas}
              >
                <FloorPlan
                  plan={FLOOR_PLAN}
                  selectedId={selectedId}
                  onSelect={pressRoom}
                  litIds={litIds}
                />
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
