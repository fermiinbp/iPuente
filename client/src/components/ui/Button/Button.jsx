// Botón en píldora. Con `to` se pinta como enlace interno (Link de React Router); con `href`, como
// enlace externo (<a>, p. ej. mailto:); sin ninguno, como <button>.
// Variantes: primary (albero, por defecto), dark (tinta, para bandas albero y superficies claras), secondary y ghost. `loading` muestra un spinner y bloquea el clic.
// Tamaños: md (44 px) y lg (52 px). Sin `size`, primary es lg y el resto md.
import { Link } from 'react-router';
import Spinner from '../Spinner/Spinner';
import styles from './Button.module.css';

const SIZES = { md: styles.md, lg: styles.lg };

export default function Button({
  variant = 'primary',
  size,
  to,
  href,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const inactive = disabled || loading;
  const variantClass = styles[variant] ? variant : 'primary';
  const sizeClass = SIZES[size] || (variantClass === 'primary' ? styles.lg : styles.md);
  const classes = [styles.button, styles[variantClass], sizeClass, className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {loading && <Spinner small label="Cargando…" />}
      {children}
    </>
  );

  if (href) {
    return (
      <a {...rest} className={classes} href={href}>
        {content}
      </a>
    );
  }

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
