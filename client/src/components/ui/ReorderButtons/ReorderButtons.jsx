// Par de botones «Subir» y «Bajar» con flechas SVG para ordenar una lista (fotos de una sala). Van sobre IconButton
// dentro de un `role="group"`. Props: `index` (posición actual), `total` (elementos de la lista), `itemLabel`
// (cómo se nombra el elemento en el nombre accesible, «la foto 2») y `onMove(from, to)`. «Subir» se desactiva en el
// primero y «Bajar» en el último. `prevRef` y `nextRef` llegan a cada botón para que quien lo usa pueda mover el foco
// al elemento movido.
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import styles from './ReorderButtons.module.css';

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' };

export default function ReorderButtons({ index, total, itemLabel, onMove, prevRef, nextRef }) {
  return (
    <div role="group" aria-label={`Ordenar ${itemLabel}`} className={styles.group}>
      <IconButton
        ref={prevRef}
        variant="secondary"
        label={`Subir ${itemLabel}`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 19V5M5 12l7-7 7 7" {...STROKE} />
        </svg>
      </IconButton>
      <IconButton
        ref={nextRef}
        variant="secondary"
        label={`Bajar ${itemLabel}`}
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14M5 12l7 7 7-7" {...STROKE} />
        </svg>
      </IconButton>
    </div>
  );
}
