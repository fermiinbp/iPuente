// Página de una planta: plano 3D con el estado de cada sala en la fecha elegida, lista de salas y panel de sala.
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import ErrorBoundary from '@/components/three/ErrorBoundary/ErrorBoundary.jsx';
import Legend from '@/components/floor-plan/Legend/Legend.jsx';
import RoomSidePanel from '@/components/room/RoomSidePanel/RoomSidePanel.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { FLOOR_CAMERA, FLOOR_PLAN } from '@/pages/Landing/floorPlanData.js';
import { FLOORS_HERO, roomsForFloor } from '@/pages/Landing/heroBuildingData.js';
import { getFloor } from '@/services/floorsService.js';
import { formatLongDate, todayString } from '@/utils/dates.js';
import { hasWebGL } from '@/utils/webgl.js';
import styles from './Floor.module.css';

// Three.js va en trozos aparte: no pesa hasta que se abre una planta.
const LazyCanvas = lazy(() => import('@/components/three/LazyCanvas/LazyCanvas.jsx'));
const FloorPlan = lazy(() => import('@/components/floor-plan/FloorPlan/FloorPlan.jsx'));

const STATUS = { FREE: 'free', OCCUPIED: 'occupied', UNAVAILABLE: 'off' };

// De la respuesta de la API (`salas` con `estado`) al formato que dibuja el plano.
// La API no devuelve pasillo: se deja sin altura.
function toPlan(floor) {
  return {
    name: floor.nombre,
    width: floor.ancho,
    height: floor.alto,
    corridor: { y: 0, height: 0 },
    rooms: floor.salas.map((sala) => ({
      id: sala.id,
      label: sala.codigo,
      name: sala.nombre,
      tipo: String(sala.tipo ?? '').toLowerCase(),
      status: STATUS[sala.estado] ?? 'off',
      x: sala.x,
      y: sala.y,
      w: sala.w,
      h: sala.h,
      people: sala.capacidad,
      price: sala.precioHora,
      equipment: [],
    })),
  };
}

// Plantas de ejemplo de la landing: si la API no responde, se enseñan con datos de muestra.
function demoPlan(floorId) {
  const floor = FLOORS_HERO.find((item) => item.id === floorId);
  if (!floor) return null;
  return { ...FLOOR_PLAN, name: floor.name, rooms: roomsForFloor(floor) };
}

export default function Floor() {
  const { buildingId, floorId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const fecha = searchParams.get('date') || todayString();
  const { data, error, loading, reload } = useFetch(
    (signal) => getFloor(floorId, { fecha, signal }),
    `${floorId}|${fecha}`,
  );
  const [selectedId, setSelectedId] = useState(null);

  const demo = error ? demoPlan(floorId) : null;
  const plan = useMemo(() => (data ? toPlan(data) : demo), [data, demo]);
  usePageTitle(plan?.name ?? 'Planta');

  const rooms = useMemo(() => plan?.rooms ?? [], [plan]);
  const selected = rooms.find((room) => room.id === selectedId) ?? null;
  // Las ocupadas se ven con la luz encendida (hay gente dentro) y también la sala elegida.
  const litIds = useMemo(
    () => rooms.filter((r) => r.status === 'occupied' || r.id === selectedId).map((r) => r.id),
    [rooms, selectedId],
  );
  const webgl = hasWebGL();

  const backTo = `/buildings/${buildingId}?date=${encodeURIComponent(fecha)}`;
  const backLink = (
    <Link className={styles.back} to={backTo}>
      <span aria-hidden="true">←</span> Volver al edificio
    </Link>
  );

  function handleDateChange(event) {
    const next = event.target.value;
    setSearchParams(next ? { date: next } : {}, { replace: true });
  }

  if (loading) {
    return (
      <div className={styles.status}>
        <Spinner label="Cargando la planta…" />
      </div>
    );
  }

  if (!plan) {
    const notFound = error?.status === 404;
    return (
      <div className={styles.status}>
        <ErrorState
          title={notFound ? 'No encontramos esta planta' : undefined}
          onRetry={notFound ? undefined : reload}
        >
          {notFound
            ? 'Puede que ya no esté publicada o que el enlace sea incorrecto.'
            : error?.message}
        </ErrorState>
        {backLink}
      </div>
    );
  }

  const freeCount = rooms.filter((room) => room.status === 'free').length;

  const sinPlano = (
    <p className={styles.note} role="note">
      Tu navegador no puede mostrar el plano en 3D. Usa la lista de salas para consultar el estado
      de cada una.
    </p>
  );

  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true">
        <span className={styles.blobA} />
        <span className={styles.blobB} />
      </div>

      <div className={styles.inner}>
        <div className={styles.info}>
          {backLink}
          <h1 className={styles.title}>{plan.name}</h1>
          <p className={styles.summary}>
            {freeCount} de {rooms.length} salas libres el {formatLongDate(fecha)}.
          </p>

          <div className={styles.date}>
            <Input
              label="Fecha"
              type="date"
              name="date"
              value={fecha}
              min={todayString()}
              onChange={handleDateChange}
            />
          </div>
          {error && demo && (
            <p className={styles.demoNote} role="note">
              Estás viendo datos de ejemplo: la API no está disponible.
            </p>
          )}

          <div role="group" aria-label="Salas de la planta" className={styles.list}>
            {rooms.map((room) => {
              const active = room.id === selectedId;
              return (
                <button
                  key={room.id}
                  type="button"
                  className={`${styles.room} ${active ? styles.roomActive : ''}`}
                  aria-pressed={active}
                  onClick={() => setSelectedId(active ? null : room.id)}
                >
                  <span className={styles.roomName}>{room.name}</span>
                  <StatusBadge status={room.status} />
                </button>
              );
            })}
          </div>

          <Legend className={styles.legend} />
          <RoomSidePanel room={selected} fecha={fecha} onClose={() => setSelectedId(null)} />
          {rooms.length === 0 && (
            <Button to={backTo} variant="secondary">
              Volver al edificio
            </Button>
          )}
        </div>

        <div className={styles.stage}>
          {webgl ? (
            <ErrorBoundary fallback={sinPlano}>
              <Suspense fallback={<p className={styles.note}>Cargando el plano…</p>}>
                <LazyCanvas
                  lazy
                  label={`Plano 3D de la ${plan.name} con ${rooms.length} salas. Pulsa una sala, en el plano o en la lista, para ver sus datos.`}
                  camera={FLOOR_CAMERA}
                  className={styles.canvas}
                >
                  <FloorPlan
                    plan={plan}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    litIds={litIds}
                  />
                </LazyCanvas>
              </Suspense>
            </ErrorBoundary>
          ) : (
            sinPlano
          )}
        </div>
      </div>
    </div>
  );
}
