// Campo numérico con botones − / + en lugar de las flechas nativas. Acepta las mismas props que `Input`
// (label, variant, error, hint…) y las de un <input type="number"> (min, max, step, value o defaultValue,
// onChange, onBlur…): respeta `min`, `max` y `step`, y sigue funcionando controlado o no.
// Los botones usan stepUp/stepDown del propio input y lanzan su evento `input`, así que `onChange` se
// comporta igual que al teclear. Con el teclado, ↑ y ↓ siguen siendo los del campo.
import { useRef, useState } from 'react';
import Input from '../Input/Input.jsx';
import styles from './NumberStepper.module.css';

function MinusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function NumberStepper({
  label,
  min,
  max,
  step,
  value,
  defaultValue,
  onChange,
  disabled,
  ...rest
}) {
  const wrapRef = useRef(null);
  const [typed, setTyped] = useState(defaultValue ?? '');
  const current = value !== undefined ? value : typed;
  const number = current === '' || current === null ? NaN : Number(current);
  const minNumber = min === undefined || min === '' ? NaN : Number(min);
  const maxNumber = max === undefined || max === '' ? NaN : Number(max);
  const atMin = Number.isFinite(number) && Number.isFinite(minNumber) && number <= minNumber;
  const atMax = Number.isFinite(number) && Number.isFinite(maxNumber) && number >= maxNumber;

  function handleChange(event) {
    setTyped(event.target.value);
    onChange?.(event);
  }

  function move(direction) {
    const input = wrapRef.current?.querySelector('input');
    if (!input) return;
    if (direction > 0) input.stepUp();
    else input.stepDown();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // El foco vuelve al campo: así un campo que confirma al salir (onBlur) recoge el valor nuevo.
    input.focus();
  }

  const buttons = (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label={`Disminuir ${label}`}
        disabled={disabled || atMin}
        onClick={() => move(-1)}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={`Aumentar ${label}`}
        disabled={disabled || atMax}
        onClick={() => move(1)}
      >
        <PlusIcon />
      </button>
    </>
  );

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <Input
        {...rest}
        label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={disabled}
        endAdornment={buttons}
      />
    </div>
  );
}
