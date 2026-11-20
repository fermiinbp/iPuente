// Texto largo con <label> visible asociado, ayuda (hint) y mensaje de error accesibles.
import { useId } from 'react';
import styles from './Textarea.module.css';

export default function Textarea({ label, hint, error, id, rows = 4, className = '', ...rest }) {
  const autoId = useId();
  const textareaId = id || autoId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [rest['aria-describedby'], hintId, errorId].filter(Boolean).join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        {...rest}
        id={textareaId}
        rows={rows}
        className={`${styles.textarea} ${error ? styles.invalid : ''}`}
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
