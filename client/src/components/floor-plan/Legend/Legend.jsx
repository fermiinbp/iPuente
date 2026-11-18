// Leyenda de estados del plano: muestra de color y texto; «No se alquila» además lleva trama diagonal.
import styles from './Legend.module.css';

const ESTADOS = [
  { clave: 'free', texto: 'Libre', clase: styles.free },
  { clave: 'occupied', texto: 'Ocupada', clase: styles.occupied },
  { clave: 'off', texto: 'No se alquila', clase: styles.off },
];

export default function Legend({ className = '' }) {
  return (
    <ul className={`${styles.legend} ${className}`} aria-label="Leyenda de estados">
      {ESTADOS.map((estado) => (
        <li key={estado.clave} className={styles.item}>
          <span className={`${styles.swatch} ${estado.clase}`} aria-hidden="true" />
          {estado.texto}
        </li>
      ))}
    </ul>
  );
}
