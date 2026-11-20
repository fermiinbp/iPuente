// Selector compacto de plantas: columna vertical tipo ascensor (tira horizontal en móvil) con un
// indicador que se desliza hasta la planta activa. Se maneja con ↑/↓ (←/→ en la tira), Inicio y Fin.
import { useEffect, useRef } from 'react';
import styles from './FloorSelector.module.css';

const KEYS_PREV = ['ArrowUp', 'ArrowLeft'];
const KEYS_NEXT = ['ArrowDown', 'ArrowRight'];

// La API real solo devuelve las salas libres de cada planta; el total solo existe en los datos de ejemplo.
const hasTotal = (floor) => Number.isFinite(floor.total);

function shortName(floor) {
  return floor.number === 0 ? 'PB' : String(floor.number);
}

// `orientation="vertical"` lo pasa a columna desde 720px; por defecto es siempre una tira horizontal.
export default function FloorSelector({
  floors,
  activeFloorId,
  onSelect,
  label = 'Plantas',
  orientation = 'horizontal',
}) {
  const buttons = useRef([]);
  const list = useRef(null);
  const activeIndex = Math.max(
    0,
    floors.findIndex((floor) => floor.id === activeFloorId),
  );

  // En la tira horizontal, la planta activa siempre queda a la vista.
  useEffect(() => {
    const strip = list.current;
    const item = buttons.current[activeIndex];
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({
      left: item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [activeIndex]);

  function handleKeyDown(event) {
    let next = -1;
    if (KEYS_PREV.includes(event.key)) next = Math.max(0, activeIndex - 1);
    else if (KEYS_NEXT.includes(event.key)) next = Math.min(floors.length - 1, activeIndex + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = floors.length - 1;
    if (next < 0) return;
    event.preventDefault();
    if (next !== activeIndex) onSelect(floors[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <nav
      className={`${styles.selector} ${orientation === 'vertical' ? styles.vertical : ''}`}
      aria-label={label}
    >
      <ul
        ref={list}
        className={styles.list}
        style={{ '--i': activeIndex }}
        onKeyDown={handleKeyDown}
      >
        <li className={styles.indicator} aria-hidden="true" />
        {floors.map((floor, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={floor.id} className={styles.item}>
              <button
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                type="button"
                className={`${styles.button} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  floor.off
                    ? `${floor.name}, no se alquila`
                    : hasTotal(floor)
                      ? `${floor.name}, ${floor.free} de ${floor.total} salas libres`
                      : `${floor.name}, ${floor.free} salas libres`
                }
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelect(floor.id)}
              >
                <span className={styles.number} aria-hidden="true">
                  {shortName(floor)}
                </span>
                <span className={styles.free} aria-hidden="true">
                  {floor.off ? '—' : hasTotal(floor) ? `${floor.free}/${floor.total}` : floor.free}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
