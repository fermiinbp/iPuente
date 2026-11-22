// Herramientas del editor: seleccionar, dibujar, borrar y deshacer.
// Barra vertical a la izquierda del lienzo (wireframe 13). «Seleccionar» y «Dibujar sala» son conmutadores
// (aria-pressed). «Borrar sala» actúa sobre la seleccionada y «Deshacer» deshace el último cambio (también Ctrl+Z).
// Guardar y publicar están en la cabecera de la página.
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import styles from './EditorToolbar.module.css';

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' };

export default function EditorToolbar({ tool, onTool, canDelete, onDelete, canUndo, onUndo }) {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Herramientas del editor"
      aria-orientation="vertical"
    >
      <IconButton
        variant="secondary"
        className={tool === 'select' ? styles.active : ''}
        label="Seleccionar y mover (V)"
        aria-pressed={tool === 'select'}
        onClick={() => onTool('select')}
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 4l12 7-5 1.5L10 18z" fill="currentColor" />
        </svg>
      </IconButton>
      <IconButton
        variant="secondary"
        className={tool === 'draw' ? styles.active : ''}
        label="Dibujar sala (R)"
        aria-pressed={tool === 'draw'}
        onClick={() => onTool('draw')}
      >
        <svg viewBox="0 0 24 24">
          <rect x="4" y="7" width="16" height="10" rx="1" {...STROKE} />
        </svg>
      </IconButton>
      <IconButton
        variant="secondary"
        label="Borrar sala (Supr)"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" {...STROKE} />
        </svg>
      </IconButton>
      <IconButton
        variant="secondary"
        label="Deshacer (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <svg viewBox="0 0 24 24">
          <path d="M9 13L4 8l5-5M4 8h10a6 6 0 010 12h-4" {...STROKE} />
        </svg>
      </IconButton>
    </div>
  );
}
