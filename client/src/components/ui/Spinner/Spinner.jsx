// Indicador de carga: aro giratorio con texto accesible. Con `small` es la variante pequeña.
import styles from './Spinner.module.css';

export default function Spinner({ small = false, label = 'Cargando…', className = '' }) {
  const classes = [styles.spinner, small ? styles.small : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="status">
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.text}>{label}</span>
    </span>
  );
}
