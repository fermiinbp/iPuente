// Cabecera: logo y navegación. Enlaces provisionales hasta tener el diseño final; el menú por rol llegará con el AuthProvider.
import { Link, NavLink } from 'react-router';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/my-bookings', label: 'Mis reservas' },
  { to: '/company', label: 'Empresa' },
  { to: '/admin', label: 'Admin' },
  { to: '/login', label: 'Entrar' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <img src={logo} alt="iPuente, inicio" width="149" height="32" />
      </Link>
      <nav aria-label="Navegación principal">
        <ul className={styles.navList}>
          {NAV_LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
