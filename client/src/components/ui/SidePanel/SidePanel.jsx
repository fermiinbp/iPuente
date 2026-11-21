// Panel lateral con título y botón de cerrar (detalle de reserva de empresa y de admin, wireframes 15b y 19b).
// - Escritorio (>= 900 px): no es modal. Se pinta en su sitio como <aside>, al lado de la lista, que sigue a la vista y
//   se puede usar. Quien lo usa lo coloca en una rejilla, p. ej. `grid-template-columns: 1fr minmax(320px, 420px)`;
//   el panel se queda fijo al hacer scroll (sticky). Al abrirse el foco va al título; Escape cierra si el foco está
//   dentro, y al cerrar el foco vuelve al elemento que lo tenía al abrir.
// - Móvil: ocupa la pantalla como un modal (portal fuera de #root, con useModalFocus): página inerte, foco atrapado,
//   Escape y pulsar el fondo cierran, y el foco vuelve al elemento que lo abrió.
// `title` es obligatorio (nombre accesible); `titleExtra` va junto al título (p. ej. un StatusBadge) y `footer`
// son los botones de abajo. Quien lo usa controla `open` y cierra con `onClose`.
import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import { useModalFocus } from '@/hooks/useModalFocus.js';
import styles from './SidePanel.module.css';

const DESKTOP = '(min-width: 900px)';

function subscribe(onChange) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isDesktop = () => window.matchMedia(DESKTOP).matches;

export default function SidePanel({
  open,
  onClose,
  title,
  titleExtra,
  children,
  footer,
  className = '',
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => true);

  // Móvil: comportamiento de modal.
  useModalFocus(open && !desktop, { containerRef: panelRef, onEscape: onClose });

  // Escritorio: foco al título al abrir y de vuelta al cerrar, sin atraparlo ni dejar la página inerte.
  useEffect(() => {
    if (!open || !desktop) return undefined;
    let returnTo = document.activeElement;
    const node = panelRef.current;
    titleRef.current?.focus();
    // La lista sigue usable: si se elige otra fila con el panel abierto, el foco volverá a esa.
    const onFocusIn = (event) => {
      if (!node?.contains(event.target)) returnTo = event.target;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      // Solo si el foco sigue en el panel o se perdió (el panel ya no está): no se lo quita a otra cosa.
      const active = document.activeElement;
      const lost = !active || active === document.body;
      if ((lost || node?.contains(active)) && returnTo?.isConnected) returnTo.focus();
    };
  }, [open, desktop]);

  if (!open) return null;

  if (import.meta.env.DEV && !title) {
    console.error('SidePanel: falta `title`, el nombre accesible del panel.');
  }

  // En escritorio Escape solo cierra si el foco está dentro (en móvil lo gestiona useModalFocus).
  const onKeyDown = (event) => {
    if (desktop && event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
    }
  };

  const panel = (
    <aside
      ref={panelRef}
      className={[styles.panel, className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      role={desktop ? undefined : 'dialog'}
      aria-modal={desktop ? undefined : 'true'}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} ref={titleRef} className={styles.title} tabIndex={-1}>
            {title}
          </h2>
          {titleExtra}
        </div>
        <IconButton label="Cerrar" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </aside>
  );

  if (desktop) return panel;

  return createPortal(
    <div className={styles.layer}>
      <div className={styles.veil} aria-hidden="true" onClick={onClose} />
      {panel}
    </div>,
    document.body,
  );
}
