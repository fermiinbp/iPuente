// Casilla con etiqueta a la derecha (puede llevar enlaces), ayuda (hint) y mensaje de error accesibles.
import { useId } from 'react';
import styles from './Checkbox.module.css';

export default function Checkbox({ label, hint, error, id, className = '', ...rest }) {
  const autoId = useId();
  const checkboxId = id || autoId;
  const hintId = hint ? `${checkboxId}-hint` : undefined;
  const errorId = error ? `${checkboxId}-error` : undefined;
  const describedBy = [rest['aria-describedby'], hintId, errorId].filter(Boolean).join(' ');
  const optionClasses = [styles.option, rest.disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={optionClasses} htmlFor={checkboxId}>
        <input
          {...rest}
          type="checkbox"
          id={checkboxId}
          className={`${styles.box} ${error ? styles.invalid : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        <span className={styles.label}>{label}</span>
      </label>
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
