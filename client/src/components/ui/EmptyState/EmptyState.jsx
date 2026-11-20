// Estado vacío: icono decorativo opcional, título, texto y acciones opcionales.
// El texto va como hijos o en `text`. `action` (una) y `actions` (varias, p. ej. con Button) se pintan juntas.
import styles from './EmptyState.module.css';

export default function EmptyState({ icon, title, text, children, action, actions }) {
  const body = children ?? text;

  return (
    <div className={styles.empty}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className={styles.title}>{title}</h3>
      {body && <p className={styles.text}>{body}</p>}
      {(action || actions) && (
        <div className={styles.action}>
          {action}
          {actions}
        </div>
      )}
    </div>
  );
}
