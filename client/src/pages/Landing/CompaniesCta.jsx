// Sección «¿Tienes oficinas?»: tres pasos, botón principal e ilustración del editor de mapas hecha con HTML y CSS.
import Button from '@/components/ui/Button/Button.jsx';
import Section from '@/components/ui/Section/Section.jsx';
import SectionTitle from '@/components/ui/SectionTitle/SectionTitle.jsx';
import { COMPANY_STEPS } from './data.js';
import styles from './CompaniesCta.module.css';

const ROOM_LABELS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'];
const ROOM_CLASSES = [styles.room1, styles.room2, styles.room3, styles.room4];

export default function CompaniesCta() {
  return (
    <Section
      id="empresas"
      titleId="empresas-titulo"
      tone="deep"
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
        className={styles.editor}
        role="img"
        aria-label="Editor de mapas: plano de una planta con cuatro salas detectadas"
      >
        <div className={styles.editorBar} aria-hidden="true">
          <span>Planta 2</span>
          <span className={styles.chip}>4 salas detectadas</span>
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
