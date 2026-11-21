// Menú de acciones que se abre con el botón «···» (tarjeta de edificio, wireframe 12c). Patrón de menú accesible:
// el botón lleva aria-haspopup y aria-expanded, la lista es role="menu" y cada opción role="menuitem".
// Teclado: Enter, Espacio o ↓ abren y enfocan la primera opción; ↑ abre y enfoca la última. Dentro, ↑ y ↓ recorren
// (dando la vuelta y saltando las desactivadas), Inicio y Fin van a la primera y la última, Escape cierra y devuelve
// el foco al botón y Tab cierra y sigue. También se cierra al pulsar fuera, al elegir una opción o al cambiar de ruta.
// `label` es obligatorio: nombre accesible del botón («Acciones de Torre Cartuja»).
// `items`: [{ label, onSelect?, to?, danger?, separated?, disabled?, hint? }]. Con `to` es un enlace; si no, un botón
// que llama a `onSelect`. `danger` la pinta como acción peligrosa (eliminar), `separated` dibuja una línea encima,
// `disabled` la deja visible pero sin efecto y `hint` es una línea de ayuda debajo (p. ej. el motivo de desactivarla).
// `align`: 'end' (por defecto, el menú se alinea a la derecha del botón) o 'start'.
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import styles from './ActionMenu.module.css';

// Siguiente opción activa desde `from` en la dirección `step` (1 o -1), dando la vuelta. -1 si no hay ninguna.
function nextEnabled(items, from, step) {
  for (let i = 1; i <= items.length; i += 1) {
    const index = (from + step * i + items.length * i) % items.length;
    if (!items[index].disabled) return index;
  }
  return -1;
}

const firstEnabled = (items) => nextEnabled(items, -1, 1);
const lastEnabled = (items) => nextEnabled(items, items.length, -1);

export default function ActionMenu({ label, items = [], align = 'end', className = '' }) {
  // Ruta en la que se abrió (al cambiar de ruta se cierra solo) y opción con el foco.
  const [openPath, setOpenPath] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { pathname } = useLocation();
  const menuId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const open = openPath === pathname;

  if (import.meta.env.DEV && !label) {
    console.error('ActionMenu: falta `label`, el nombre accesible del botón.');
  }

  const openAt = (index) => {
    setActiveIndex(index);
    setOpenPath(pathname);
  };

  const close = ({ returnFocus = false } = {}) => {
    setOpenPath(null);
    setActiveIndex(-1);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Mueve el foco a la opción activa cada vez que cambia.
  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Pulsar fuera cierra sin mover el foco.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpenPath(null);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onButtonClick = () => {
    if (open) close();
    else openAt(firstEnabled(items));
  };

  const onButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openAt(firstEnabled(items));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(lastEnabled(items));
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };

  const onMenuKeyDown = (event) => {
    const moves = {
      ArrowDown: () => nextEnabled(items, activeIndex, 1),
      ArrowUp: () => nextEnabled(items, activeIndex, -1),
      Home: () => firstEnabled(items),
      End: () => lastEnabled(items),
    };
    if (moves[event.key]) {
      event.preventDefault();
      const index = moves[event.key]();
      if (index >= 0) setActiveIndex(index);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close({ returnFocus: true });
    } else if (event.key === 'Tab') {
      // Sin preventDefault: el foco sigue al siguiente elemento de la página.
      close();
    }
  };

  // El foco vuelve al botón antes de la acción: si la acción abre un modal, al cerrarlo el foco regresa al «···».
  const select = (item) => {
    if (item.disabled) return;
    close({ returnFocus: true });
    item.onSelect?.();
  };

  const rootClasses = [styles.actionMenu, className].filter(Boolean).join(' ');
  const menuClasses = [styles.menu, align === 'start' ? styles.alignStart : styles.alignEnd].join(
    ' ',
  );

  return (
    <div ref={rootRef} className={rootClasses}>
      <IconButton
        ref={buttonRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={onButtonClick}
        onKeyDown={onButtonKeyDown}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </IconButton>

      {open && (
        <ul
          id={menuId}
          className={menuClasses}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => {
            const hintId = item.hint ? `${menuId}-hint-${index}` : undefined;
            const itemClasses = [styles.item, item.danger ? styles.danger : '']
              .filter(Boolean)
              .join(' ');
            const common = {
              ref: (node) => {
                itemRefs.current[index] = node;
              },
              role: 'menuitem',
              tabIndex: index === activeIndex ? 0 : -1,
              className: itemClasses,
              'aria-disabled': item.disabled || undefined,
              'aria-describedby': hintId,
            };
            const content = (
              <>
                <span>{item.label}</span>
                {item.hint && (
                  <span id={hintId} className={styles.hint}>
                    {item.hint}
                  </span>
                )}
              </>
            );

            return (
              <li
                key={item.label}
                role="none"
                className={item.separated ? styles.separated : undefined}
              >
                {item.to && !item.disabled ? (
                  <Link {...common} to={item.to} onClick={() => close()}>
                    {content}
                  </Link>
                ) : (
                  <button {...common} type="button" onClick={() => select(item)}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
