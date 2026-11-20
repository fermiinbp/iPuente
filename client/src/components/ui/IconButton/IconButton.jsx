// Botón solo con icono (barra del editor, cerrar paneles y modales, menú móvil). `label` es obligatorio:
// es el nombre accesible del botón (aria-label). El icono llega como children y se oculta a los lectores de pantalla.
// Variantes: ghost (por defecto) y secondary (con borde). `loading` cambia el icono por un spinner y bloquea el clic.
import Spinner from '../Spinner/Spinner';
import styles from './IconButton.module.css';

export default function IconButton({
  label,
  variant = 'ghost',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  if (import.meta.env.DEV && !label) {
    console.error('IconButton: falta `label`, el nombre accesible del botón.');
  }
  const inactive = disabled || loading;
  const classes = [styles.iconButton, styles[variant] || styles.ghost, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      className={classes}
      type={type}
      aria-label={label}
      disabled={inactive}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <Spinner small label="Cargando…" />
      ) : (
        <span className={styles.icon} aria-hidden="true">
          {children}
        </span>
      )}
    </button>
  );
}
