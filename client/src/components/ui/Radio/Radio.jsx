// Grupo de botones de opción: fieldset con legend (`label`), opciones `{ value, label, disabled }`,
// ayuda (hint) y mensaje de error accesibles. Radios nativos con el mismo `name`: se manejan con las flechas.
// Controlado con `value` + `onChange`, o sin controlar con `defaultValue`.
// `hideLegend` oculta el título a la vista (p. ej. cuando ya lo da la cabecera de una tabla).
import { useId } from 'react';
import styles from './Radio.module.css';

export default function Radio({
  label,
  name,
  options = [],
  value,
  defaultValue,
  onChange,
  hint,
  error,
  disabled = false,
  hideLegend = false,
  className = '',
}) {
  const autoId = useId();
  const groupName = name || autoId;
  const hintId = hint ? `${autoId}-hint` : undefined;
  const errorId = error ? `${autoId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ');

  return (
    <fieldset
      className={[styles.field, className].filter(Boolean).join(' ')}
      aria-describedby={describedBy || undefined}
      disabled={disabled}
    >
      <legend className={hideLegend ? styles.srOnly : styles.legend}>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => {
          const optionId = `${autoId}-${option.value}`;
          const checkedProps =
            value !== undefined
              ? { checked: value === option.value }
              : { defaultChecked: defaultValue === option.value };

          return (
            <label
              key={option.value}
              className={[styles.option, option.disabled ? styles.disabled : '']
                .filter(Boolean)
                .join(' ')}
              htmlFor={optionId}
            >
              <input
                type="radio"
                id={optionId}
                name={groupName}
                value={option.value}
                className={`${styles.circle} ${error ? styles.invalid : ''}`}
                disabled={option.disabled}
                aria-invalid={error ? true : undefined}
                onChange={onChange}
                {...checkedProps}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
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
    </fieldset>
  );
}
