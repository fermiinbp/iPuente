// Sección «Cómo funciona»: tres pasos numerados.
import { HOW_IT_WORKS_STEPS } from './data.js';
import styles from './HowItWorks.module.css';

export default function HowItWorks() {
  return (
    <section className={styles.section} aria-labelledby="como-titulo">
      <div className={styles.inner}>
        <h2 className={styles.title} id="como-titulo">
          Cómo funciona
        </h2>
        <ol className={styles.steps}>
          {HOW_IT_WORKS_STEPS.map((step) => (
            <li key={step.number} className={styles.step}>
              <span className={styles.number} aria-hidden="true">
                {step.number}
              </span>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepText}>{step.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
