// Cabecera: logo, navegación centrada, acceso y CTA. Debajo de 900 px la navegación pasa a un panel «Menú».
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { signOutUser } from '@/services/authService.js';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/#salas', label: 'Espacios' },
  { to: '/#empresas', label: 'Para empresas' },
  { to: '/#como', label: 'Cómo funciona' },
  { to: '/#pie', label: 'Contacto' },
];

// Enlaces de la cuenta con sesión iniciada: «Mis reservas» para todos y el panel que corresponda al rol.
const ACCOUNT_LINKS = [
  { to: '/my-bookings', label: 'Mis reservas', roles: ['CLIENT', 'COMPANY', 'ADMIN'] },
  { to: '/company', label: 'Panel de empresa', roles: ['COMPANY'] },
  { to: '/admin', label: 'Administración', roles: ['ADMIN'] },
];

export default function Header() {
  const [openPath, setOpenPath] = useState(null);
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const accountLinks = user ? ACCOUNT_LINKS.filter((link) => link.roles.includes(role)) : [];

  async function handleLogout() {
    setOpenPath(null);
    await signOutUser();
    navigate('/');
  }
  const buttonRef = useRef(null);
  const routeKey = `${pathname}${hash}`;
  // El panel solo está abierto en la ruta en la que se abrió: al cambiar de ruta se cierra.
  const open = openPath === routeKey;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpenPath(null);

  // Los enlaces llevan ancla, así que el activo se decide por el hash y no por la ruta.
  const renderLink = ({ to, label }, className) => {
    const active = pathname === '/' && to === `/${hash}`;
    return (
      <Link
        to={to}
        className={active ? `${className} ${styles.active}` : className}
        onClick={close}
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
              <li key={link.to}>{renderLink(link, styles.navLink)}</li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          {!loading && user ? (
            <>
              {accountLinks.map((link) => (
                <Link key={link.to} to={link.to} className={`${styles.navLink} ${styles.login}`}>
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                className={`${styles.navLink} ${styles.login} ${styles.logout}`}
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link to="/login" className={`${styles.navLink} ${styles.login}`}>
              Iniciar sesión
            </Link>
          )}
          <Button to="/company/register" className={styles.cta}>
            Publica tu oficina
          </Button>
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

        {open && (
          <div id="menu-movil" className={styles.panel}>
            {NAV_LINKS.map((link) => (
              <span key={link.to} className={styles.panelItem}>
                {renderLink(link, styles.panelLink)}
              </span>
            ))}
            {!loading && user ? (
              <>
                {accountLinks.map((link) => (
                  <Link key={link.to} to={link.to} className={styles.panelLink} onClick={close}>
                    {link.label}
                  </Link>
                ))}
                <button
                  type="button"
                  className={`${styles.panelLink} ${styles.logout}`}
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <Link to="/login" className={styles.panelLink} onClick={close}>
                Iniciar sesión
              </Link>
            )}
            <Link
              to="/company/register"
              className={`${styles.panelLink} ${styles.panelCta}`}
              onClick={close}
            >
              Publica tu oficina
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
