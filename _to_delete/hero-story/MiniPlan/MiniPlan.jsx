// Plano 2D pequeño de una planta, hecho con HTML y CSS (sin Three.js). Cada sala es un botón colocado
// con porcentajes; solo las libres se pueden elegir. El estado va siempre escrito, no solo en color.
import styles from './MiniPlan.module.css';

const STATUS_LABELS = { free: 'Libre', occupied: 'Ocupada', off: 'No se alquila' };
const STATUS_CLASS = { free: styles.free, occupied: styles.occupied, off: styles.off };

export default function MiniPlan({ rooms, width, height, selectedId, onSelect }) {
  return (
    <div
      className={styles.plan}
      role="group"
      aria-label="Plano de la planta"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {rooms.map((room) => {
        const free = room.status === 'free';
        const selected = room.id === selectedId;
        const label = free
          ? `Sala ${room.id}, libre, ${room.price} euros la hora, hasta ${room.people} personas`
          : `Sala ${room.id}, ${STATUS_LABELS[room.status].toLowerCase()}`;
        return (
          <button
            key={room.id}
            type="button"
            className={`${styles.room} ${STATUS_CLASS[room.status]} ${selected ? styles.selected : ''}`}
            style={{
              left: `${(room.x / width) * 100}%`,
              top: `${(room.y / height) * 100}%`,
              width: `${(room.w / width) * 100}%`,
              height: `${(room.h / height) * 100}%`,
            }}
            aria-label={label}
            aria-pressed={free ? selected : undefined}
            aria-disabled={free ? undefined : 'true'}
            onClick={free ? () => onSelect(room.id) : undefined}
          >
            <span className={styles.code}>{room.id}</span>
            <span className={styles.state}>{STATUS_LABELS[room.status]}</span>
            {selected && <span className={styles.price}>{room.price} €/h</span>}
          </button>
        );
      })}
    </div>
  );
}
