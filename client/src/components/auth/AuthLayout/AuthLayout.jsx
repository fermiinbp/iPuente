// Marco de las pantallas de acceso (entrar, crear cuenta, recuperar contraseña): fondo vivo y tarjeta centrada.
import styles from './AuthLayout.module.css';

export default function AuthLayout({ title, lead, footer, children }) {
  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true">
        <span className={styles.blobA} />
        <span className={styles.blobB} />
      </div>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children}
        {footer && <p className={styles.footer}>{footer}</p>}
      </div>
    </div>
  );
}
