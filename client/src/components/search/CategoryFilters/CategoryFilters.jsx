// Filtro de salas por tipo: grupo de botones con aria-pressed (solo uno activo).
import styles from './CategoryFilters.module.css';

export default function CategoryFilters({ filters, active, onChange }) {
  return (
    <div role="group" aria-label="Filtrar por tipo de sala" className={styles.group}>
      {filters.map((filter) => {
        const isActive = filter === active;
        return (
          <button
            key={filter}
            type="button"
            className={`${styles.chip} ${isActive ? styles.active : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(filter)}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
