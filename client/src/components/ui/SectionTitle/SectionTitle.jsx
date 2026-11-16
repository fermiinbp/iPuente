// Título <h2> de una sección de la landing. El `id` lo referencia el `aria-labelledby` de su <Section>.
import styles from './SectionTitle.module.css';

export default function SectionTitle({ id, className = '', children }) {
  return (
    <h2 className={[styles.title, className].filter(Boolean).join(' ')} id={id}>
      {children}
    </h2>
  );
}
