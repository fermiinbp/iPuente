// Campo de formulario con <label> visible asociado, ayuda (hint) y mensaje de error accesibles.
// `variant="inline"` (por defecto) es el campo sin borde del buscador; `variant="boxed"` es el campo con borde de formulario.
import { useId } from 'react';
import styles from './Input.module.css';

export default function Input({
  label,
  hint,
  error,
  id,
  variant = 'inline',
  className = '',
  ...rest
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [rest['aria-describedby'], hintId, errorId].filter(Boolean).join(' ');
  const classes = [styles.field, variant === 'boxed' ? styles.boxed : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className={`${styles.input} ${error ? styles.invalid : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
