// Sección de planta: selector de plantas, lista de salas, detalle de la seleccionada y plano 3D donde la sala elegida se eleva.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { hasWebGL } from '@/utils/webgl.js';
import FloorSelector from '@/components/building/FloorSelector/FloorSelector.jsx';
import ErrorBoundary from '@/components/three/ErrorBoundary/ErrorBoundary.jsx';
import Legend from '@/components/floor-plan/Legend/Legend.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { FLOOR_CAMERA, FLOOR_PLAN, STATUS_LABELS } from '../floorPlanData.js';
import { FLOORS_HERO, HERO_STORY, roomsForFloor } from '../heroBuildingData.js';
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

const CELEBRATE_MS = 2600;
// La planta baja es recepción y no se alquila: no aparece en el selector.
const RENTABLE_FLOORS = FLOORS_HERO.filter((floor) => !floor.off);

export default function FloorSection({ buildingName = 'edificio' }) {
  const [floorId, setFloorId] = useState(HERO_STORY.floorId);
  // Sentido del último cambio ('up' si sube de planta, 'down' si baja): decide hacia dónde entra el contenido.
  const [direction, setDirection] = useState('up');
  const floor = RENTABLE_FLOORS.find((item) => item.id === floorId) ?? RENTABLE_FLOORS[0];
  const rooms = useMemo(() => roomsForFloor(floor), [floor]);
  const plan = useMemo(() => ({ ...FLOOR_PLAN, name: floor.name, rooms }), [floor.name, rooms]);
  // Las salas ocupadas empiezan con la luz encendida (hay gente dentro); las libres, a oscuras.
  const initialLit = useMemo(
    () => rooms.filter((r) => r.status === 'occupied').map((r) => r.id),
    [rooms],
  );
  const lightable = useMemo(
    () => rooms.filter((r) => r.status !== 'off').map((r) => r.id),
    [rooms],
  );
  const freeIds = useMemo(() => rooms.filter((r) => r.status === 'free').map((r) => r.id), [rooms]);

  const [selectedId, setSelectedId] = useState(null);
  const [litIds, setLitIds] = useState(initialLit);
  const [celebrating, setCelebrating] = useState(false);
  const wasComplete = useRef(false);
  const webgl = hasWebGL();
  const selected = rooms.find((room) => room.id === selectedId) ?? null;
  const freeCount = freeIds.length;

  // Al cambiar de planta se empieza de cero: sin sala elegida y con las luces de esa planta.
  function handleSelectFloor(id) {
    if (id === floorId) return;
    const from = RENTABLE_FLOORS.findIndex((item) => item.id === floorId);
    const to = RENTABLE_FLOORS.findIndex((item) => item.id === id);
    if (to < 0) return;
    const next = RENTABLE_FLOORS[to];
    setDirection(to < from ? 'up' : 'down');
    setFloorId(id);
    setSelectedId(null);
    setLitIds(
      roomsForFloor(next)
        .filter((r) => r.status === 'occupied')
        .map((r) => r.id),
    );
    setCelebrating(false);
  }

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
    if (!lightable.includes(id)) return;
    setLitIds((actual) => {
      const lit = actual.includes(id);
      if (wasSelected) return lit ? actual.filter((x) => x !== id) : actual;
      return lit ? actual : [...actual, id];
    });
  }

  // Juego: encender las salas libres. Al completarlas todas, mensaje y destello (una vez por vez).
  const freeLit = freeIds.filter((id) => litIds.includes(id)).length;
  const complete = freeIds.length > 0 && freeLit === freeIds.length;
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
        <div key={`${floor.id}-title`} className={styles.swap} data-direction={direction}>
          <SectionTitle id="planta-titulo">{floor.name}</SectionTitle>
        </div>

        <FloorSelector
          floors={RENTABLE_FLOORS}
          activeFloorId={floor.id}
          onSelect={handleSelectFloor}
          label={`Plantas del ${buildingName}`}
        />

        <div key={floor.id} className={styles.swap} data-direction={direction}>
          <p className={styles.summary}>
            {freeCount} de {rooms.length} salas libres hoy. Pulsa una sala para verla en el plano y
            encender su luz.
          </p>

          <p className={styles.lightsScore}>
            Luces de las salas libres:{' '}
            <strong>
              {freeLit} de {freeIds.length}
            </strong>
          </p>
          <p
            className={`${styles.celebration} ${celebrating ? styles.celebrationOn : ''}`}
            role="status"
          >
            {celebrating
              ? `¡Planta iluminada! Las ${freeIds.length} salas libres están listas para reservar.`
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
      </div>

      <div
        key={`${floor.id}-stage`}
        className={`${styles.stage} ${styles.swap} ${celebrating ? styles.stageFlash : ''}`}
        data-direction={direction}
      >
        {webgl ? (
          <ErrorBoundary fallback={sinPlano}>
            <Suspense fallback={<p className={styles.note}>Cargando el plano…</p>}>
              <LazyCanvas
                lazy
                label={`Plano 3D de la ${floor.name} con ${rooms.length} salas y sus luces. Pulsa una sala, en el plano o en la lista, para seleccionarla y encender su luz.`}
                camera={FLOOR_CAMERA}
                className={styles.canvas}
              >
                <FloorPlan
                  plan={plan}
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
