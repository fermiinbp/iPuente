// Pasos numerados con el actual destacado (los 4 pasos del alta de empresa, wireframes 10 y 10b).
// `steps`: textos de los pasos; `current`: número del paso actual (empieza en 1).
// Hecho, actual y pendiente se distinguen con texto (para lectores de pantalla), no solo con color.
import styles from './Stepper.module.css';

const STATE_TEXT = { done: 'completado', current: 'paso actual', pending: 'pendiente' };

export default function Stepper({ steps = [], current = 1, label = 'Pasos', className = '' }) {
  return (
    <ol className={[styles.stepper, className].filter(Boolean).join(' ')} aria-label={label}>
      {steps.map((step, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'pending';

        return (
          <li
            key={step}
            className={`${styles.step} ${styles[state]}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden="true">
              {state === 'done' ? '✓' : number}
            </span>
            <span className={styles.text}>
              {step}
              <span className={styles.srOnly}> ({STATE_TEXT[state]})</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
