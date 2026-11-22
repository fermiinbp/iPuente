// Campo de formulario con <label> visible asociado, ayuda (hint) y mensaje de error accesibles.
// `endAdornment` pone un control (p. ej. los botones de NumberStepper) dentro del campo, a la derecha.
// Los campos numéricos no enseñan las flechas nativas: usan NumberStepper.
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
  endAdornment,
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

  const field = (
    <input
      {...rest}
      id={inputId}
      className={[styles.input, error ? styles.invalid : '', endAdornment ? styles.withEnd : '']
        .filter(Boolean)
        .join(' ')}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
    />
  );

  return (
    <div className={classes}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      {endAdornment ? (
        <div className={styles.control}>
          {field}
          <div className={styles.endAdornment}>{endAdornment}</div>
        </div>
      ) : (
        field
      )}
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
