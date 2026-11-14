// Plantilla con menú lateral para los paneles de empresa y admin. Provisional hasta tener el diseño final.
import { NavLink, Outlet } from 'react-router';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout({ title, links }) {
  return (
    <div className={styles.dashboard}>
      <nav className={styles.sidebar} aria-label={title}>
        <p className={styles.title}>{title}</p>
        <ul className={styles.menu}>
          {links.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
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
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
