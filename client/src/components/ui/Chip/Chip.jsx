// Píldora pequeña. Con `selected` es un filtro seleccionable: botón con aria-pressed que se usa con teclado.
// Sin `selected` es una etiqueta informativa (p. ej. «Black Room I · 25 €/h»).
import styles from './Chip.module.css';

export default function Chip({ selected, className = '', children, ...rest }) {
  if (selected !== undefined) {
    const classes = [styles.chip, styles.filter, selected ? styles.selected : '', className]
      .filter(Boolean)
      .join(' ');

    return (
      <button type="button" {...rest} className={classes} aria-pressed={selected}>
        {children}
      </button>
    );
  }

  return (
    <span {...rest} className={[styles.chip, styles.info, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
