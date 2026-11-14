// Pie de página: logo y copyright.
import logo from '@/assets/images/ipuente-logo-sobre-oscuro.svg';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <img className={styles.logo} src={logo} alt="iPuente" width="130" height="28" />
      <p>© {new Date().getFullYear()} iPuente</p>
    </footer>
  );
}
