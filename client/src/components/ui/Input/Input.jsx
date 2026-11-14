// Campo de formulario con etiqueta visible encima (el <label> envuelve al <input>).
import styles from './Input.module.css';

export default function Input({ label, ...rest }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} {...rest} />
    </label>
  );
}
