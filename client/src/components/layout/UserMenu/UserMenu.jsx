// Menú desplegable del usuario en escritorio: avatar y nombre que abren un panel con sus datos y sus opciones.
// Patrón de botón que despliega (aria-expanded): se abre con Enter o Espacio y se cierra con Escape (el foco vuelve
// al botón), al pulsar fuera, al sacar el foco del menú, al elegir una opción o al cambiar de ruta.
// `items`: [{ label, to?, separated? }]. Sin `to` se pinta como botón sin destino (ver los TODO de Header).
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Avatar from '@/components/ui/Avatar/Avatar.jsx';
import styles from './UserMenu.module.css';

export default function UserMenu({ name, email, photoUrl, items = [] }) {
  const [openPath, setOpenPath] = useState(null);
  const { pathname } = useLocation();
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  // Solo está abierto en la ruta en la que se abrió: al cambiar de ruta se cierra.
  const open = openPath === pathname;
  const firstName = name.split(/\s+/)[0];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpenPath(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = () => setOpenPath(null);

  // Con Tab fuera del menú también se cierra. Sin relatedTarget (clic en una zona sin foco) decide el pointerdown,
  // así no se pierde el clic en Safari, donde los botones no reciben el foco al pulsarlos.
  const onBlur = (event) => {
    const next = event.relatedTarget;
    if (next && !rootRef.current?.contains(next)) close();
  };

  return (
    <div ref={rootRef} className={styles.userMenu} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        {/* El nombre ya va en texto: el avatar se oculta para no leerlo dos veces. */}
        <span className={styles.avatar} aria-hidden="true">
          <Avatar name={name} src={photoUrl} />
        </span>
        <span className={styles.triggerName}>{firstName}</span>
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
        <span className={styles.srOnly}>, menú de usuario</span>
      </button>

      {open && (
        <div id={panelId} className={styles.panel}>
          <div className={styles.identity}>
            <p className={styles.name}>{name}</p>
            {email && <p className={styles.email}>{email}</p>}
          </div>
          <ul className={styles.list}>
            {items.map(({ label, to, separated }) => (
              <li key={label} className={separated ? styles.separated : undefined}>
                {to ? (
                  <Link to={to} className={styles.item} onClick={close}>
                    {label}
                  </Link>
                ) : (
                  <button type="button" className={styles.item} onClick={close}>
                    {label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
