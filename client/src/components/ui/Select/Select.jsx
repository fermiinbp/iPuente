// Desplegable con <label> visible asociado, ayuda (hint) y mensaje de error accesibles.
// Las opciones van como hijos (<option>); `placeholder` añade una primera opción vacía y desactivada,
// que solo se ve si el valor inicial es '' (`value=""` o `defaultValue=""`).
import { useId } from 'react';
import styles from './Select.module.css';

export default function Select({
  label,
  hint,
  error,
  id,
  placeholder,
  className = '',
  children,
  ...rest
}) {
  const autoId = useId();
  const selectId = id || autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [rest['aria-describedby'], hintId, errorId].filter(Boolean).join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <div className={styles.control}>
        <select
          {...rest}
          id={selectId}
          className={`${styles.select} ${error ? styles.invalid : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
      </div>
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
