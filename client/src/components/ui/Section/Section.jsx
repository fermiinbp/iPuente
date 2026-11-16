// Sección de página: fondo, línea superior opcional y contenedor centrado con el ancho máximo.
// El contenido se maqueta con `innerClassName` (flex, rejilla…); aquí solo va lo común.
import styles from './Section.module.css';

const TONES = { base: styles.toneBase, elevated: styles.toneElevated, deep: styles.toneDeep };

export default function Section({
  id,
  titleId,
  tone = 'base',
  bordered = true,
  spacious = false,
  className = '',
  innerClassName = '',
  children,
}) {
  const sectionClasses = [
    styles.section,
    TONES[tone] || styles.toneBase,
    bordered ? styles.bordered : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const innerClasses = [styles.inner, spacious ? styles.spacious : '', innerClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={sectionClasses} id={id} aria-labelledby={titleId}>
      <div className={innerClasses}>{children}</div>
    </section>
  );
}
