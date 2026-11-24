// Marco de las pantallas de acceso (entrar, crear cuenta, recuperar contraseña): sin cabecera ni pie.
// En escritorio, un panel de marca a la izquierda y el formulario a la derecha; en móvil, solo el formulario.
import { Link } from 'react-router';
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import symbol from '@/assets/images/ipuente-simbolo.svg';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ title, lead, footer, children }) {
  return (
    <main className={styles.page}>
      <div className={styles.visual} aria-hidden="true">
        <img className={styles.symbol} src={symbol} alt="" />
        <p className={styles.claim}>Elige tu sala en el plano y resérvala por horas.</p>
      </div>
      <div className={styles.panel} data-superficie="clara">
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
    </main>
  );
}
