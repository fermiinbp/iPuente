// Pie de página: logo, enlaces a rutas existentes y copyright.
import { Link } from 'react-router';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './Footer.module.css';

const COLUMNS = [
  {
    title: 'Clientes',
    links: [
      { to: '/#salas', label: 'Buscar salas' },
      { to: '/#como', label: 'Cómo funciona' },
    ],
  },
  {
    title: 'Empresas',
    links: [{ to: '/company/register', label: 'Publica tu oficina' }],
  },
];

export default function Footer() {
  return (
    <footer id="pie" className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img className={styles.logo} src={logo} alt="iPuente" width="130" height="28" />
        </div>
        {COLUMNS.map(({ title, links }) => (
          <nav key={title} className={styles.column} aria-label={title}>
            <p className={styles.columnTitle}>{title}</p>
            {links.map(({ to, label }) => (
              <Link key={to} to={to} className={styles.link}>
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className={styles.legal}>
        <p className={styles.copy}>© {new Date().getFullYear()} iPuente</p>
      </div>
    </footer>
  );
}
