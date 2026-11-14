// Edificio dibujado con CSS: una banda pulsable por planta. La planta activa se ilumina y el panel
// de debajo dice cuántas salas libres tiene y enlaza a su plano.
import { Link } from 'react-router';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import styles from './BuildingHero.module.css';

export default function BuildingHero({
  buildingId,
  buildingName,
  floors,
  activeFloorId,
  onSelectFloor,
}) {
  const active = floors.find((floor) => floor.id === activeFloorId);

  return (
    <div className={styles.hero}>
      <div role="group" aria-label={`Plantas del ${buildingName}`} className={styles.building}>
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
