// Botón en píldora. Con `to` se pinta como enlace (<a href>); sin `to`, como <button>.
// Variantes: primary (por defecto), secondary y ghost. `loading` muestra un spinner y bloquea el clic.
import { Link } from 'react-router';
import Spinner from '../Spinner/Spinner';
import styles from './Button.module.css';

export default function Button({
  variant = 'primary',
  to,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const inactive = disabled || loading;
  const classes = [styles.button, styles[variant] || styles.primary, className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {loading && <Spinner small label="Cargando…" />}
      {children}
    </>
  );

  if (to) {
    const handleClick = (event) => {
      if (inactive) {
        event.preventDefault();
        return;
      }
      rest.onClick?.(event);
    };
    return (
      <Link
        {...rest}
        className={classes}
        to={to}
        onClick={handleClick}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        tabIndex={inactive ? -1 : rest.tabIndex}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      {...rest}
      className={classes}
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
