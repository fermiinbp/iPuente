// Sección «¿Tienes oficinas?»: tres pasos, botón principal e ilustración del editor de mapas hecha con HTML y CSS.
// Al llegar a la sección, una línea recorre el plano y las salas se «detectan» una a una, una sola vez.
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { COMPANY_STEPS } from '../data.js';
import styles from './CompaniesCta.module.css';

const ROOM_LABELS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'];
const ROOM_CLASSES = [styles.room1, styles.room2, styles.room3, styles.room4];
const DETECT_MS = 2000;

// Fases: antes (salas ocultas), play (la IA recorre el plano) y listo (todo a la vista).
// Sin animación posible (movimiento reducido o sin IntersectionObserver) arranca en «listo».
function initialPhase() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return reduced || !('IntersectionObserver' in window) ? 'listo' : 'antes';
}

export default function CompaniesCta() {
  const [phase, setPhase] = useState(initialPhase);
  const editorRef = useRef(null);

  useEffect(() => {
    if (phase !== 'antes') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('play');
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(editorRef.current);
    return () => observer.disconnect();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play') return undefined;
    const timer = setTimeout(() => setPhase('listo'), DETECT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <Section
      id="empresas"
      titleId="empresas-titulo"
      tone="elevated"
      bordered={false}
      innerClassName={styles.inner}
    >
      <div className={styles.text}>
        <SectionTitle id="empresas-titulo">Tus oficinas, publicadas en minutos</SectionTitle>
        <p className={styles.lead}>Sube la imagen del plano y la IA detecta tus salas.</p>
        <ol className={styles.steps}>
          {COMPANY_STEPS.map((step, index) => (
            <li key={step} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div>
          <Button to="/company/register">Publica tu oficina</Button>
        </div>
      </div>

      <div
        ref={editorRef}
        className={styles.editor}
        data-phase={phase}
        role="img"
        aria-label="Editor de mapas: plano de una planta con cuatro salas detectadas"
      >
        <div className={styles.editorBar} aria-hidden="true">
          <span>Planta 2</span>
          <span className={styles.chip}>
            {phase === 'listo' ? '4 salas detectadas' : 'Analizando el plano…'}
          </span>
        </div>
        <div className={styles.plan} aria-hidden="true">
          <div className={styles.wallOuter} />
          <div className={styles.wallH} />
          <div className={styles.wallV1} />
          <div className={styles.wallV2} />
          <div className={styles.scan} />
          {ROOM_LABELS.map((label, index) => (
            <div key={label} className={`${styles.room} ${ROOM_CLASSES[index]}`}>
              <span className={styles.roomTag}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
