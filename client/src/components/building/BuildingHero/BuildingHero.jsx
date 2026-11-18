// Edificio del hero: con WebGL se ve en 3D (arrastra para girar) y los botones de planta pasan a ser
// una fila compacta (también con movimiento reducido, entonces estático); sin WebGL se dibuja con CSS, una banda pulsable por planta.
// Los botones HTML mandan: el 3D solo refleja la planta activa. El panel de debajo dice cuántas salas
// libres tiene y enlaza a su plano.
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import ErrorBoundary from '@/components/three/ErrorBoundary/ErrorBoundary.jsx';
import { hasWebGL } from '@/utils/webgl.js';
import styles from './BuildingHero.module.css';

// Three.js solo se descarga cuando el hero se monta con 3D.
const Building3D = lazy(() => import('@/components/building/Building3D/Building3D.jsx'));

export default function BuildingHero({
  buildingId,
  buildingName,
  floors,
  activeFloorId,
  onSelectFloor,
  // Opcionales: con `selectedFloorId` la planta abierta la decide quien usa el componente (`onOpenFloor`).
  selectedFloorId,
  onOpenFloor,
  showInfo = true,
  // Con `false` no se pinta la rejilla de botones de planta: quien lo usa pone su propio selector.
  showFloorList = true,
  hint = 'Arrastra para girar y pulsa una planta para abrirla',
  children,
}) {
  const active = floors.find((floor) => floor.id === activeFloorId);
  const [webgl] = useState(() => hasWebGL());
  const use3d = webgl;
  // Última planta confirmada por clic o teclado: es lo único que anuncia el lector de pantalla.
  const [announced, setAnnounced] = useState('');
  const announcedFloor = floors.find((floor) => floor.id === announced);
  // Planta abierta en el 3D (las de encima suben y se desvanecen): se abre y se cierra con un clic.
  const [ownSelectedId, setOwnSelectedId] = useState('');
  const controlled = selectedFloorId !== undefined;
  const selectedId = controlled ? selectedFloorId : ownSelectedId;

  function handleSelect(id) {
    onSelectFloor(id);
    if (controlled) onOpenFloor?.(id);
    else setOwnSelectedId((current) => (current === id ? '' : id));
    setAnnounced(id);
  }

  const ghost = (
    <div className={styles.ghost} aria-hidden="true">
      {floors.map((floor) => (
        <span key={floor.id} className={styles.ghostSlab} />
      ))}
    </div>
  );

  return (
    <div className={styles.hero}>
      {use3d && (
        <div className={styles.stage}>
          <ErrorBoundary fallback={ghost}>
            <Suspense fallback={ghost}>
              <Building3D
                floors={floors}
                activeFloorId={activeFloorId}
                selectedFloorId={selectedId}
                onHoverFloor={onSelectFloor}
                onSelectFloor={handleSelect}
                label={`Maqueta 3D del ${buildingName}`}
              />
            </Suspense>
          </ErrorBoundary>
          <p className={styles.hint}>{hint}</p>
        </div>
      )}
      {children}
      {showFloorList && (
        <div
          role="group"
          aria-label={`Plantas del ${buildingName}`}
          className={`${styles.building} ${use3d ? styles.compact : ''}`}
        >
          <div className={styles.roof} aria-hidden="true" />
          {floors.map((floor) => {
            const isActive = floor.id === activeFloorId;
            const rowClass = [
              styles.floor,
              isActive ? styles.active : '',
              floor.off ? styles.ground : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={floor.id}
                type="button"
                className={rowClass}
                aria-pressed={isActive}
                onClick={() => handleSelect(floor.id)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') onSelectFloor(floor.id);
                }}
              >
                <span className={styles.slab} aria-hidden="true">
                  <span className={styles.windows} />
                </span>
                <span className={styles.name}>{floor.name}</span>
              </button>
            );
          })}
          <div className={styles.base} aria-hidden="true" />
        </div>
      )}

      <p className={styles.srOnly} aria-live="polite">
        {announcedFloor
          ? announcedFloor.off
            ? `${announcedFloor.name} seleccionada. Recepción, no se alquila.`
            : `${announcedFloor.name} seleccionada. ${announcedFloor.free} salas libres hoy.`
          : ''}
      </p>
      <div className={styles.info} hidden={!showInfo}>
        {active && (
          <>
            <p className={styles.infoTitle}>{active.name}</p>
            {active.off ? (
              <p className={styles.infoText}>
                <StatusBadge status="off" /> Recepción. Esta planta no se alquila.
              </p>
            ) : (
              <>
                <p className={styles.infoText}>
                  <StatusBadge status="free" /> {active.free} salas libres hoy
                </p>
                <Link
                  className={styles.infoLink}
                  to={`/buildings/${buildingId}/floors/${active.id}`}
                >
                  Ver el plano de la planta {active.number}
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
