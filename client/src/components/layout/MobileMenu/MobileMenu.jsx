// Menú de navegación a pantalla completa en móvil (por debajo de 900 px). Se pinta en un portal fuera de #root,
// deja la página inerte y sin scroll mientras está abierto (como LandingLoader) y atrapa el foco dentro.
// Se cierra con la ×, con Escape, al elegir un enlace o al pasar a escritorio; al cerrar, el foco vuelve a `returnFocusRef`.
// `account`: null sin sesión, o { name, email, items: [{ label, to?, separated? }] } con sesión.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './MobileMenu.module.css';

const FOCUSABLE = 'a[href], button:not([disabled])';
const DESKTOP = '(min-width: 900px)';

export default function MobileMenu({ id, navLinks, account, loading, onClose, returnFocusRef }) {
  const { pathname, hash } = useLocation();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Aislamiento: página inerte y sin scroll; al cerrar se devuelve el foco al botón «Menú».
  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const returnTo = returnFocusRef?.current;
    root?.setAttribute('inert', '');
    html.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      html.style.overflow = prevOverflow;
      returnTo?.focus();
    };
  }, [returnFocusRef]);

  // Escape cierra y Tab no sale del menú.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!focusable?.length) return;
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
  }, [onClose]);

  // En escritorio no hay menú móvil: si se agranda la ventana con el menú abierto, se cierra.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = (event) => {
      if (event.matches) onClose();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [onClose]);

  const renderItem = (item) =>
    item.to ? (
      <Link to={item.to} className={styles.link} onClick={onClose}>
        {item.label}
      </Link>
    ) : (
      <button
        type="button"
        className={styles.link}
        onClick={() => {
          item.onSelect?.();
          onClose();
        }}
      >
        {item.label}
      </button>
    );

  return createPortal(
    <div
      ref={dialogRef}
      id={id}
      className={styles.mobileMenu}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
    >
      <div className={styles.top}>
        <Link to="/" className={styles.logo} onClick={onClose}>
          <img src={logo} alt="iPuente, inicio" width="149" height="32" />
        </Link>
        <IconButton ref={closeRef} label="Cerrar menú" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>

      <div className={styles.body}>
        <nav aria-label="Principal">
          <ul className={styles.list}>
            {navLinks.map(({ to, label }) => {
              // Los enlaces llevan ancla: el activo se decide por el hash, como en Header.
              const active = pathname === '/' && to === `/${hash}`;
              return (
                <li key={to} className={styles.navItem}>
                  <Link
                    to={to}
                    className={active ? `${styles.link} ${styles.active}` : styles.link}
                    onClick={onClose}
                    aria-current={active ? 'location' : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {!loading && !account && (
          <div className={styles.actions}>
            <Button to="/company/register" onClick={onClose}>
              Publica tu oficina
            </Button>
            <Button to="/login" variant="secondary" size="lg" onClick={onClose}>
              Iniciar sesión
            </Button>
          </div>
        )}

        {!loading && account && (
          <div className={styles.account}>
            <div className={styles.identity}>
              <p className={styles.name}>{account.name}</p>
              {account.email && <p className={styles.email}>{account.email}</p>}
            </div>
            <ul className={styles.list}>
              {account.items.map((item) => (
                <li key={item.label}>{renderItem(item)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
