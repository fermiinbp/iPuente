// Sección «Cómo funciona»: tres pasos numerados.
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { HOW_IT_WORKS_STEPS } from '../data.js';
import styles from './HowItWorks.module.css';

export default function HowItWorks() {
  return (
    <Section id="como" titleId="como-titulo">
      <SectionTitle id="como-titulo">Cómo funciona</SectionTitle>
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
    </Section>
  );
}
