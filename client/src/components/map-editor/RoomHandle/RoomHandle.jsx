// Sala editable con tiradores para mover y redimensionar. Es un <g> dentro del <svg> de MapEditor, en coordenadas
// del plano. Con ratón: pulsar la selecciona y arrastrar la mueve; las 4 esquinas (solo en la seleccionada) la
// redimensionan. El arrastre lo gestiona MapEditor (`onPointerDownBody` y `onPointerDownCorner`).
// Con teclado: cada sala está en el orden de tabulación; Enter o Espacio la selecciona, las flechas la mueven,
// Mayús + flechas cambian su tamaño, Supr o Retroceso la borran y Escape quita la selección.
import { GRID } from '@/utils/mapGeometry.js';
import styles from './RoomHandle.module.css';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export default function RoomHandle({
  room,
  selected,
  handleSize,
  onSelect,
  onPointerDownBody,
  onPointerDownCorner,
  onMove,
  onGrow,
  onDelete,
  onDeselect,
}) {
  const { x, y, w, h } = room;
  const label = `${room.codigo} · ${room.nombre}`;

  const onKeyDown = (event) => {
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      if (!selected) onSelect();
      const [dx, dy] = arrow;
      if (event.shiftKey) onGrow(dx * GRID, dy * GRID);
      else onMove(dx * GRID, dy * GRID);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDelete();
    } else if (event.key === 'Escape' && selected) {
      event.preventDefault();
      onDeselect();
    }
  };

  const corners = {
    nw: [x, y],
    ne: [x + w, y],
    sw: [x, y + h],
    se: [x + w, y + h],
  };

  return (
    <g
      className={`${styles.room} ${selected ? styles.selected : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${label}. Posición ${x}, ${y}; tamaño ${w} por ${h}`}
      data-room-id={room.id}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => onPointerDownBody(event, room)}
    >
      <rect className={styles.body} x={x} y={y} width={w} height={h} />
      <text className={styles.code} x={x + 6} y={y + 6} dominantBaseline="hanging">
        {room.codigo}
      </text>
      {selected &&
        CORNERS.map((corner) => (
          <rect
            key={corner}
            className={`${styles.corner} ${styles[corner]}`}
            x={corners[corner][0] - handleSize / 2}
            y={corners[corner][1] - handleSize / 2}
            width={handleSize}
            height={handleSize}
            aria-hidden="true"
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDownCorner(event, room, corner);
            }}
          />
        ))}
    </g>
  );
}
