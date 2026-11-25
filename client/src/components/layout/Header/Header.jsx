// Cabecera: logo, navegación centrada y, según la sesión, acceso y CTA o el enlace del rol y UserMenu.
// Debajo de 900 px la navegación pasa a MobileMenu (pantalla completa), que se abre con el botón «Menú».
import { useCallback, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import BridgeCable from '@/components/layout/BridgeCable/BridgeCable.jsx';
import MobileMenu from '@/components/layout/MobileMenu/MobileMenu.jsx';
import UserMenu from '@/components/layout/UserMenu/UserMenu.jsx';
import { ACCOUNT_ITEMS, LOGOUT, displayName } from '@/config/accountMenu.js';
import { signOutUser } from '@/services/authService.js';
import { ROLES } from '@/config/constants.js';
import { useAuth } from '@/hooks/useAuth.js';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/#salas', label: 'Espacios' },
  { to: '/#empresas', label: 'Para empresas' },
  { to: '/#como', label: 'Cómo funciona' },
  { to: '/#pie', label: 'Contacto' },
];

// Enlace de cada rol junto al menú de usuario.
const ROLE_LINKS = {
  [ROLES.CLIENT]: { to: '/my-bookings', label: 'Mis reservas' },
  [ROLES.COMPANY]: { to: '/company', label: 'Empresa' },
  [ROLES.ADMIN]: { to: '/admin', label: 'Admin' },
};

export default function Header() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [openPath, setOpenPath] = useState(null);
  const { pathname, hash } = useLocation();
  const buttonRef = useRef(null);
  const routeKey = `${pathname}${hash}`;
  // El menú móvil solo está abierto en la ruta en la que se abrió: al cambiar de ruta se cierra.
  const open = openPath === routeKey;
  const closeMenu = useCallback(() => setOpenPath(null), []);

  // «Cerrar sesión»: cierra la sesión de Firebase y vuelve a la home.
  const logoutItem = {
    ...LOGOUT,
    onSelect: async () => {
      await signOutUser();
      navigate('/');
    },
  };

  const roleLink = user ? (ROLE_LINKS[role] ?? ROLE_LINKS[ROLES.CLIENT]) : null;
  const accountItems = user ? (ACCOUNT_ITEMS[role] ?? ACCOUNT_ITEMS[ROLES.CLIENT]) : [];
  const name = user ? displayName(user) : '';
  const roleActive = Boolean(roleLink) && pathname.startsWith(roleLink.to);

  // En móvil, el enlace del rol va dentro del menú (el de cliente ya está en sus opciones).
  const mobileAccount = user && {
    name,
    email: user.email,
    items: [
      ...(role === ROLES.COMPANY || role === ROLES.ADMIN ? [roleLink] : []),
      ...accountItems.filter((item) => !item.desktopOnly),
      logoutItem,
    ],
  };

  // Los enlaces llevan ancla, así que el activo se decide por el hash y no por la ruta.
  const renderLink = ({ to, label }) => {
    const active = pathname === '/' && to === `/${hash}`;
    return (
      <Link
        to={to}
        className={active ? `${styles.navLink} ${styles.active}` : styles.navLink}
        aria-current={active ? 'location' : undefined}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <img src={logo} alt="iPuente, inicio" width="149" height="32" />
        </Link>

        <nav className={styles.nav} aria-label="Principal">
          <ul className={styles.navList}>
            {NAV_LINKS.map((link) => (
              <li key={link.to}>{renderLink(link)}</li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          {/* Mientras se comprueba la sesión no se pinta nada, para no enseñar «Iniciar sesión» de más. */}
          {!loading && !user && (
            <>
              <Link to="/login" className={`${styles.navLink} ${styles.desktopOnly}`}>
                Iniciar sesión
              </Link>
              <Button to="/company/register" className={styles.desktopOnly}>
                Publica tu oficina
              </Button>
            </>
          )}
          {!loading && user && (
            <>
              <Link
                to={roleLink.to}
                className={[styles.navLink, styles.desktopOnly, roleActive && styles.active]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={roleActive ? 'page' : undefined}
              >
                {roleLink.label}
              </Link>
              <div className={styles.desktopOnly}>
                <UserMenu
                  name={name}
                  email={user.email}
                  photoUrl={user.photoURL}
                  items={[...accountItems, logoutItem]}
                />
              </div>
            </>
          )}
          <button
            ref={buttonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="menu-movil"
            onClick={() => setOpenPath(open ? null : routeKey)}
          >
            Menú
          </button>
        </div>
      </div>

      <BridgeCable />

      {open && (
        <MobileMenu
          id="menu-movil"
          navLinks={NAV_LINKS}
          account={mobileAccount}
          loading={loading}
          onClose={closeMenu}
          returnFocusRef={buttonRef}
        />
      )}
    </header>
  );
}
