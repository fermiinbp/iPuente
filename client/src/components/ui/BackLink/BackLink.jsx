// Enlace «← Volver a…» (p. ej. «← Volver a Mis reservas», «← Mis edificios»). Recibe el destino (`to`) y el texto.
// La flecha es decorativa (aria-hidden): el nombre del enlace es solo el texto.
import { Link } from 'react-router';
import styles from './BackLink.module.css';

export default function BackLink({ to, className = '', children, ...rest }) {
  const classes = [styles.backLink, className].filter(Boolean).join(' ');
  return (
    <Link {...rest} to={to} className={classes}>
      <span className={styles.arrow} aria-hidden="true">
        ←
      </span>
      {children}
    </Link>
  );
}
