// Hoja que sube desde abajo en móvil (panel de sala en la planta, filtros de la búsqueda; wireframes 03 y 22 móvil).
// Desde 900 px se ve como un panel centrado. Mismas props que Modal: `title` es obligatorio (nombre accesible) y
// `footer` son los botones. Con useModalFocus: se pinta fuera de #root, deja la página inerte y sin scroll, atrapa el
// foco y lo devuelve al cerrar. Se cierra con su botón, con Escape y pulsando el fondo. Quien la usa pone el botón que
// la abre y controla `open`.
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import { useModalFocus } from '@/hooks/useModalFocus.js';
import styles from './BottomSheet.module.css';

export default function BottomSheet({ open, onClose, title, children, footer, className = '' }) {
  const titleId = useId();
  const sheetRef = useRef(null);

  useModalFocus(open, { containerRef: sheetRef, onEscape: onClose });

  if (!open) return null;

  if (import.meta.env.DEV && !title) {
    console.error('BottomSheet: falta `title`, el nombre accesible de la hoja.');
  }

  return createPortal(
    <div className={styles.layer}>
      <div className={styles.veil} aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        className={[styles.sheet, className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
