// Plantilla de los paneles de empresa y admin (wireframes 11 y 16): menú lateral con logo, etiqueta del rol, secciones y
// «Cerrar sesión», y barra superior con UserMenu. Sustituye a la cabecera y el pie públicos.
// Sin `links` no hay menú lateral y el logo pasa a la barra (estado de la solicitud de alta, wireframe 10b).
// Por debajo de 900 px el menú lateral se abre con «Menú» como panel deslizante: página inerte y sin scroll, foco
// atrapado y cierre con ×, Escape, al elegir una opción o al pasar a escritorio (como MobileMenu).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import UserMenu from '@/components/layout/UserMenu/UserMenu.jsx';
import Chip from '@/components/ui/Chip/Chip.jsx';
import IconButton from '@/components/ui/IconButton/IconButton.jsx';
import { ACCOUNT_ITEMS, LOGOUT, displayName } from '@/config/accountMenu.js';
import { ROLES } from '@/config/constants.js';
import { useAuth } from '@/hooks/useAuth.js';
import { getMyCompany } from '@/services/companyService.js';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './DashboardLayout.module.css';

const ROLE_BADGES = { [ROLES.COMPANY]: 'Empresa', [ROLES.ADMIN]: 'Admin' };
const FOCUSABLE = 'a[href], button:not([disabled])';
const DESKTOP = '(min-width: 900px)';

export default function DashboardLayout({ title, links = [] }) {
  const { user, role } = useAuth();
  const uid = user?.uid;
  const { pathname } = useLocation();
  // Nombre de la empresa junto al uid de quien lo pidió, para no mostrar el de otra cuenta.
  const [company, setCompany] = useState(null);
  const [openPath, setOpenPath] = useState(null);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const hasSidebar = links.length > 0;
  // El panel móvil solo está abierto en la ruta en la que se abrió: al cambiar de ruta se cierra.
  const open = hasSidebar && openPath === pathname;
  const closeMenu = useCallback(() => setOpenPath(null), []);

  // Cada página empieza arriba, como en Layout.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  // Nombre de la empresa desde la API. Si falla (p. ej. sin API en local), se queda el nombre de la cuenta.
  useEffect(() => {
    if (role !== ROLES.COMPANY) return undefined;
    const controller = new AbortController();
    getMyCompany({ signal: controller.signal })
      .then((data) => setCompany({ uid, name: data?.name ?? null }))
      .catch(() => {});
    return () => controller.abort();
  }, [role, uid]);

  // Panel móvil abierto: página inerte y sin scroll; al cerrar, el foco vuelve al botón «Menú».
  useEffect(() => {
    if (!open) return undefined;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const returnTo = menuButtonRef.current;
    root?.setAttribute('inert', '');
    html.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      html.style.overflow = prevOverflow;
      returnTo?.focus();
    };
  }, [open]);

  // Escape cierra, Tab no sale del panel y al pasar a escritorio se cierra.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll(FOCUSABLE);
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
    const query = window.matchMedia(DESKTOP);
    const onChange = (event) => {
      if (event.matches) closeMenu();
    };
    document.addEventListener('keydown', onKey);
    query.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      query.removeEventListener('change', onChange);
    };
  }, [open, closeMenu]);

  const companyName = role === ROLES.COMPANY && company?.uid === uid ? company.name : null;
  const name = companyName || displayName(user);
  const badge = ROLE_BADGES[role];
  const accountItems = [...(ACCOUNT_ITEMS[role] ?? []), LOGOUT];

  const brand = (
    <div className={styles.brand}>
      <Link to="/" className={styles.logo}>
        <img src={logo} alt="iPuente, inicio" width="149" height="32" />
      </Link>
      {badge && <Chip>{badge}</Chip>}
    </div>
  );

  // Contenido del menú lateral, igual en escritorio y en el panel móvil.
  const renderSidebar = (onNavigate) => (
    <>
      <nav className={styles.nav} aria-label={title}>
        <ul className={styles.menu}>
          {links.map(({ to, label, end }) => (
            <li key={to}>
              {/* TODO(UI019): icono de cada opción del menú (assets/icons), con aria-hidden. */}
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  isActive ? `${styles.menuLink} ${styles.active}` : styles.menuLink
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* TODO(CLI001): «Cerrar sesión» debe llamar a logout() de services/authService.js. */}
      <button type="button" className={styles.logout} onClick={onNavigate}>
        {LOGOUT.label}
      </button>
    </>
  );

  return (
    <div className={styles.dashboard}>
      {hasSidebar && (
        <aside className={styles.sidebar}>
          {brand}
          {renderSidebar()}
        </aside>
      )}

      <div className={styles.main}>
        <header className={styles.topbar}>
          {hasSidebar && (
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              aria-expanded={open}
              aria-controls="menu-panel"
              onClick={() => setOpenPath(open ? null : pathname)}
            >
              Menú
            </button>
          )}
          <div className={hasSidebar ? styles.topbarBrand : undefined}>{brand}</div>
          <div className={styles.account}>
            {user && (
              <UserMenu
                name={name}
                email={user.email}
                photoUrl={user.photoURL}
                items={accountItems}
              />
            )}
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      {open &&
        createPortal(
          <div className={styles.drawerLayer}>
            <div className={styles.veil} onClick={closeMenu} aria-hidden="true" />
            <div
              ref={drawerRef}
              id="menu-panel"
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <div className={styles.drawerTop}>
                {brand}
                <IconButton ref={closeRef} label="Cerrar menú" onClick={closeMenu}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </IconButton>
              </div>
              {renderSidebar(closeMenu)}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
