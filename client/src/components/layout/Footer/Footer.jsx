// Pie de página. Provisional hasta tener el diseño final.
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p>© {new Date().getFullYear()} iPuente</p>
    </footer>
  );
}
