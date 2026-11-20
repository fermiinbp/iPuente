// Marco de las pantallas de acceso (entrar, crear cuenta, recuperar contraseña): sin cabecera ni pie,
// con el logo que vuelve al inicio, fondo vivo y tarjeta centrada.
import { Link } from 'react-router';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ title, lead, footer, children }) {
  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true">
        <span className={styles.blobA} />
        <span className={styles.blobB} />
      </div>
      <Link to="/" className={styles.home}>
        <img src={logo} alt="iPuente, volver al inicio" width="149" height="32" />
      </Link>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children}
        {footer && <p className={styles.footer}>{footer}</p>}
      </div>
    </div>
  );
}
