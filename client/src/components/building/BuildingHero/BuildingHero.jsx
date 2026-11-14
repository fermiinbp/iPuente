// Edificio del hero: con WebGL se ve en 3D (arrastra para girar) y los botones de planta pasan a ser
// una fila compacta; sin WebGL o con movimiento reducido se dibuja con CSS, una banda pulsable por planta.
// Los botones HTML mandan: el 3D solo refleja la planta activa. El panel de debajo dice cuántas salas
// libres tiene y enlaza a su plano.
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
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
}) {
  const active = floors.find((floor) => floor.id === activeFloorId);
  const reducedMotion = useReducedMotion();
  const [webgl] = useState(() => hasWebGL());
  const use3d = webgl && !reducedMotion;

  return (
    <div className={styles.hero}>
      {use3d && (
        <div className={styles.stage}>
          <Suspense
            fallback={
              <div className={styles.ghost} aria-hidden="true">
                {floors.map((floor) => (
                  <span key={floor.id} className={styles.ghostSlab} />
                ))}
              </div>
            }
          >
            <Building3D
              floors={floors}
              activeFloorId={activeFloorId}
              label={`Maqueta 3D del ${buildingName}`}
            />
          </Suspense>
          <p className={styles.hint}>Arrastra para girar</p>
        </div>
      )}
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
              onClick={() => onSelectFloor(floor.id)}
              onMouseEnter={() => onSelectFloor(floor.id)}
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

      <div className={styles.info} aria-live="polite">
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
