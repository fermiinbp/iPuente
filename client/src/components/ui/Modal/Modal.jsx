// Ventana modal accesible (cierre con Escape y foco atrapado). Se pinta en un portal fuera de #root y, con
// useModalFocus, deja la página inerte y sin scroll, lleva el foco dentro (a `initialFocusRef` o al primer elemento)
// y lo devuelve al cerrar. Se cierra con Escape y pulsando el fondo, salvo con `dismissible={false}` (p. ej. cargando).
// `title` es obligatorio: es el nombre accesible del diálogo. `footer` son los botones; `size`: md (por defecto) o lg.
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/hooks/useModalFocus.js';
import styles from './Modal.module.css';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissible = true,
  initialFocusRef,
  describedBy,
  className = '',
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const close = dismissible ? onClose : undefined;

  useModalFocus(open, { containerRef: panelRef, initialFocusRef, onEscape: close });

  if (!open) return null;

  if (import.meta.env.DEV && !title) {
    console.error('Modal: falta `title`, el nombre accesible del diálogo.');
  }

  const classes = [styles.panel, size === 'lg' ? styles.lg : '', className]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div className={styles.layer}>
      <div className={styles.veil} aria-hidden="true" onClick={close} />
      <div
        ref={panelRef}
        className={classes}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
