// Estado de error: título que explica qué pasó, texto opcional y botón «Reintentar» opcional.
import Button from '../Button/Button';
import styles from './ErrorState.module.css';

export default function ErrorState({
  title = 'No hemos podido cargar los datos',
  children,
  onRetry,
}) {
  return (
    <div className={styles.error} role="alert">
      <h3 className={styles.title}>{title}</h3>
      {children && <p className={styles.text}>{children}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
