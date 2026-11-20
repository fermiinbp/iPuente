// Migas de pan: «Inicio / Sevilla / Edificio Puerta Sur». `items` es [{ label, to? }]; el último no lleva enlace
// y es la página actual (aria-current="page"). Los separadores son decorativos.
import { Link } from 'react-router';
import styles from './Breadcrumbs.module.css';

export default function Breadcrumbs({ items, label = 'Migas de pan' }) {
  return (
    <nav aria-label={label}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {last || !item.to ? (
                <span className={styles.current} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link className={styles.link} to={item.to}>
                  {item.label}
                </Link>
              )}
              {!last && (
                <span className={styles.separator} aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
