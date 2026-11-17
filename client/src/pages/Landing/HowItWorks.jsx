// Sección «Cómo funciona»: tres pasos numerados, cada uno con un mini-visual hecho con HTML y CSS.
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { HOW_IT_WORKS_STEPS } from './data.js';
import styles from './HowItWorks.module.css';

// Paso 1: las plantas del edificio, con la elegida resaltada. Datos de ejemplo.
const FLOORS = [
  { name: 'Planta 3', free: 2 },
  { name: 'Planta 2', free: 3, active: true },
  { name: 'Planta 1', free: 1 },
  { name: 'Baja', free: 4 },
];

// Paso 2: seis salas del plano con su estado; la elegida enseña su precio.
const ROOMS = [
  { code: '2.01', status: 'free', selected: true },
  { code: '2.02', status: 'occupied' },
  { code: '2.03', status: 'free' },
  { code: '2.04', status: 'off' },
  { code: '2.05', status: 'free' },
  { code: '2.06', status: 'occupied' },
];
const ROOM_STATUS_CLASS = { free: styles.free, occupied: styles.occupied, off: styles.off };

function FloorsVisual() {
  return (
    <ul className={styles.floors}>
      {FLOORS.map((floor) => (
        <li key={floor.name} className={floor.active ? styles.floorActive : styles.floor}>
          <span>{floor.name}</span>
          <span>{floor.free} libres</span>
        </li>
      ))}
    </ul>
  );
}

function PlanVisual() {
  return (
    <div className={styles.plan}>
      {ROOMS.map((room) => (
        <span
          key={room.code}
          className={`${styles.room} ${ROOM_STATUS_CLASS[room.status]} ${
            room.selected ? styles.roomSelected : ''
          }`}
        >
          {room.code}
        </span>
      ))}
      <span className={styles.priceTag}>12 €/h</span>
    </div>
  );
}

function PayVisual() {
  return (
    <div className={styles.ticket}>
      <span className={styles.ticketRoom}>Sala 2.01</span>
      <span className={styles.ticketTime}>Mañana · 10:00–12:00</span>
      <span className={styles.ticketTotal}>
        <span>2 h × 12 €</span>
        <strong>24 €</strong>
      </span>
      <span className={styles.ticketChip}>Pago confirmado</span>
    </div>
  );
}

const VISUALS = [FloorsVisual, PlanVisual, PayVisual];

export default function HowItWorks() {
  return (
    <Section id="como" titleId="como-titulo" tone="crema" bordered={false}>
      <SectionTitle id="como-titulo">Cómo funciona</SectionTitle>
      <ol className={styles.steps}>
        {HOW_IT_WORKS_STEPS.map((step, index) => {
          const Visual = VISUALS[index];
          return (
            <li key={step.number} className={styles.step}>
              <div className={styles.visual} aria-hidden="true">
                {Visual ? <Visual /> : null}
              </div>
              <span className={styles.number} aria-hidden="true">
                {step.number}
              </span>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepText}>{step.text}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
