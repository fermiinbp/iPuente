// Estado de error del servidor o sin conexión: título que explica qué pasó, texto opcional,
// botón «Reintentar» opcional (`onRetry`) y otras acciones opcionales (`actions`, p. ej. con Button).
// Con `offline`, el título por defecto pasa a «Parece que no tienes conexión».
import Button from '../Button/Button';
import styles from './ErrorState.module.css';

export default function ErrorState({ title, offline = false, children, onRetry, actions }) {
  const heading =
    title ?? (offline ? 'Parece que no tienes conexión' : 'No hemos podido cargar los datos');

  return (
    <div className={styles.error} role="alert">
      <h3 className={styles.title}>{heading}</h3>
      {children && <p className={styles.text}>{children}</p>}
      {(onRetry || actions) && (
        <div className={styles.actions}>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Reintentar
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
