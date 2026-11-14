// Sección «¿Tienes oficinas?»: tres pasos, botón principal e ilustración del editor de mapas hecha con HTML y CSS.
import Button from '@/components/ui/Button/Button.jsx';
import { COMPANY_STEPS } from './data.js';
import styles from './CompaniesCta.module.css';

const ROOM_LABELS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'];
const ROOM_CLASSES = [styles.room1, styles.room2, styles.room3, styles.room4];

export default function CompaniesCta() {
  return (
    <section className={styles.section} aria-labelledby="empresas-titulo">
      <div className={styles.inner}>
        <div className={styles.text}>
          <h2 className={styles.title} id="empresas-titulo">
            ¿Tienes oficinas?
          </h2>
          <p className={styles.lead}>
            Publícalas en minutos: sube tu plano y detectamos tus salas.
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
      </div>
    </section>
  );
}
