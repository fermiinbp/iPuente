// Cifra destacada con su título debajo, para los resúmenes de empresa y admin (wireframes 11 y 16).
import styles from './StatCard.module.css';

export default function StatCard({ value, label, className = '' }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      <p className={styles.value}>{value}</p>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
