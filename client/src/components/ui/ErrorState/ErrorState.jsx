// Estado de error del servidor o sin conexión: título que explica qué pasó, texto opcional,
// botón «Reintentar» opcional (`onRetry`), «Volver al inicio» opcional (`home`) y otras acciones (`actions`).
// Con `offline` (o con un `error` de red del apiClient) el título pasa a «Parece que no tienes conexión».
// `home` añade «Volver al inicio». Con `page` es un error de página entera: sin borde lateral y con una palabra
// grande decorativa («Ups» por defecto, o la de `code`, p. ej. «404»). Sin `page` es un error incrustado en una pantalla.
// El foco va al título al aparecer, para que se anuncie y se pueda seguir con el teclado.
import { useEffect, useRef } from 'react';
import Button from '../Button/Button';
import styles from './ErrorState.module.css';

export default function ErrorState({
  title,
  offline = false,
  error,
  home = false,
  page = false,
  code,
  children,
  onRetry,
  actions,
}) {
  const isOffline = offline || error?.code === 'NETWORK_ERROR';
  const heading =
    title ?? (isOffline ? 'Parece que no tienes conexión' : 'Algo ha fallado por nuestra parte');
  const text = children ?? (isOffline ? 'Revisa tu conexión e inténtalo de nuevo.' : undefined);
  const headingRef = useRef(null);
  const bigWord = code ?? (page ? 'Ups' : null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={`${styles.error} ${page ? styles.page : ''}`} role="alert">
      {bigWord && (
        <p className={styles.code} aria-hidden="true">
          {bigWord}
        </p>
      )}
      <h3 className={styles.title} ref={headingRef} tabIndex={-1}>
        {heading}
      </h3>
      {text && <p className={styles.text}>{text}</p>}
      {(onRetry || home || actions) && (
        <div className={styles.actions}>
          {onRetry && (
            <Button variant={page ? 'primary' : 'secondary'} onClick={onRetry}>
              Reintentar
            </Button>
          )}
          {home && (
            <Button to="/" variant="secondary">
              Volver al inicio
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
