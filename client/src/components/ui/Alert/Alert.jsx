// Mensaje dentro de una pantalla. `tone`: 'info' (por defecto), 'error', 'warning' o 'success'.
// Los errores se anuncian como alerta; el resto, como aviso de estado.
import styles from './Alert.module.css';

const TONE_CLASS = {
  error: styles.error,
  warning: styles.warning,
  success: styles.success,
  info: styles.info,
};

export default function Alert({ tone = 'info', children }) {
  return (
    <div
      className={`${styles.alert} ${TONE_CLASS[tone] ?? styles.info}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
