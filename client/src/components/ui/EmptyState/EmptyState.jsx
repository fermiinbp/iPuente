// Estado vacío: icono decorativo opcional, título, texto y acción opcional.
import styles from './EmptyState.module.css';

export default function EmptyState({ icon, title, children, action }) {
  return (
    <div className={styles.empty} role="status">
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className={styles.title}>{title}</h3>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
