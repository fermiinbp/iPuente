// Mensaje dentro de una pantalla. `type`: 'error', 'warning', 'success' o 'info' (por defecto).
// Error y aviso usan role="alert" (se anuncian enseguida); éxito e info, role="status".
// El tipo también se dice con texto (oculto a la vista), no solo con color.
import styles from './Alert.module.css';

const TYPES = {
  error: { role: 'alert', prefix: 'Error', className: styles.error },
  warning: { role: 'alert', prefix: 'Aviso', className: styles.warning },
  success: { role: 'status', prefix: 'Hecho', className: styles.success },
  info: { role: 'status', prefix: 'Información', className: styles.info },
};

export default function Alert({ type = 'info', title, children, className = '' }) {
  const config = TYPES[type] ?? TYPES.info;
  const classes = [styles.alert, config.className, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role={config.role}>
      <span className={styles.srOnly}>{config.prefix}: </span>
      {title && <p className={styles.title}>{title}</p>}
      {children && <div className={styles.text}>{children}</div>}
    </div>
  );
}
