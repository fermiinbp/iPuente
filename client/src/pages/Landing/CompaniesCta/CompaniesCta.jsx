// Sección «¿Tienes oficinas?»: tres pasos, botón principal e ilustración del editor de mapas hecha con HTML y CSS.
// Al llegar a la sección, las salas se van dibujando sobre el plano una a una, una sola vez.
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { COMPANY_STEPS } from '../data.js';
import styles from './CompaniesCta.module.css';

const ROOM_LABELS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'];
const ROOM_CLASSES = [styles.room1, styles.room2, styles.room3, styles.room4];
const DRAW_MS = 2000;

// Fases: antes (salas ocultas), play (se dibujan las salas) y listo (todo a la vista).
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
    const timer = setTimeout(() => setPhase('listo'), DRAW_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <Section
      id="empresas"
      titleId="empresas-titulo"
      tone="elevated"
      decor="glow"
      innerClassName={styles.inner}
    >
      <div className={styles.text}>
        <p className={styles.eyebrow}>Para empresas</p>
        <SectionTitle id="empresas-titulo">
          ¿Tienes oficinas? <em>Ponlas a trabajar</em>
        </SectionTitle>
        <p className={styles.lead}>
          Sube la imagen del plano y dibuja tus salas encima. Tus clientes las ven libres en el
          plano, reservan por horas y pagan online.
        </p>
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
          <Button to="/company/register" variant="primary" size="lg">
            Publica tu oficina
          </Button>
        </div>
      </div>

      <div
        ref={editorRef}
        className={styles.editor}
        data-phase={phase}
        role="img"
        aria-label="Editor de mapas: plano de una planta con cuatro salas dibujadas"
      >
        <div className={styles.editorBar} aria-hidden="true">
          <span>Planta 2</span>
          <span className={styles.chip}>
            {phase === 'listo' ? '4 salas en el plano' : 'Dibujando salas…'}
          </span>
        </div>
        <div className={styles.plan} aria-hidden="true">
          <div className={styles.wallOuter} />
          <div className={styles.wallH} />
          <div className={styles.wallV1} />
          <div className={styles.wallV2} />
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
