// Botón principal en píldora crema. Con `to` se pinta como enlace (<a href>); sin `to`, como <button>.
import { Link } from 'react-router';
import styles from './Button.module.css';

export default function Button({ to, type = 'button', children, ...rest }) {
  if (to) {
    return (
      <Link className={styles.button} to={to} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={styles.button} type={type} {...rest}>
      {children}
    </button>
  );
}
