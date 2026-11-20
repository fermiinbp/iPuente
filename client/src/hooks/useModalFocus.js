// Comportamiento común de lo que se abre por encima de la página (Modal, MobileMenu y el menú móvil de DashboardLayout).
// Mientras `active` es true: la página (#root) queda inerte y sin scroll, el foco entra en `containerRef`, Tab no sale
// de él y Escape llama a `onEscape` (si no se pasa, Escape no hace nada). Al desactivarse lo deshace todo y devuelve
// el foco a `returnFocusRef` o, si no se pasa, al elemento que tenía el foco al abrir.
// El contenedor tiene que pintarse fuera de #root (createPortal a document.body); si no, también quedaría inerte.
import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocus(
  active,
  { containerRef, onEscape, initialFocusRef, returnFocusRef } = {},
) {
  // Aislamiento de la página y foco de entrada y de salida.
  useEffect(() => {
    if (!active) return undefined;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const returnTo = returnFocusRef?.current ?? document.activeElement;
    root?.setAttribute('inert', '');
    html.style.overflow = 'hidden';

    const container = containerRef?.current;
    const first =
      initialFocusRef?.current ?? container?.querySelector(FOCUSABLE) ?? container ?? null;
    first?.focus();

    return () => {
      root?.removeAttribute('inert');
      html.style.overflow = prevOverflow;
      returnTo?.focus?.();
    };
  }, [active, containerRef, initialFocusRef, returnFocusRef]);

  // Escape cierra y Tab da la vuelta dentro del contenedor.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = containerRef?.current?.querySelectorAll(FOCUSABLE);
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape, containerRef]);
}
