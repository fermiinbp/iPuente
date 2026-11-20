// Elección de una opción entre pocas, con aspecto de botones unidos (tipo de sala en el editor, wireframe 13).
// Por dentro es un grupo de radios nativos: anuncia la opción elegida y se maneja con las flechas.
// Opciones `{ value, label }`; controlado con `value` + `onChange`, o sin controlar con `defaultValue`.
import { useId } from 'react';
import styles from './SegmentedControl.module.css';

export default function SegmentedControl({
  label,
  name,
  options = [],
  value,
  defaultValue,
  onChange,
  disabled = false,
  className = '',
}) {
  const autoId = useId();
  const groupName = name || autoId;

  return (
    <fieldset className={[styles.field, className].filter(Boolean).join(' ')} disabled={disabled}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.segments}>
        {options.map((option) => {
          const optionId = `${autoId}-${option.value}`;
          const checkedProps =
            value !== undefined
              ? { checked: value === option.value }
              : { defaultChecked: defaultValue === option.value };

          return (
            <div key={option.value} className={styles.segment}>
              <input
                type="radio"
                id={optionId}
                name={groupName}
                value={option.value}
                className={styles.input}
                onChange={onChange}
                {...checkedProps}
              />
              <label className={styles.label} htmlFor={optionId}>
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
