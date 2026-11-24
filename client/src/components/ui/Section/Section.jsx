// Sección de página: fondo, línea superior opcional y contenedor centrado con el ancho máximo.
// El contenido se maqueta con `innerClassName` (flex, rejilla…); aquí solo va lo común.
import styles from './Section.module.css';

const TONES = {
  base: styles.toneBase,
  elevated: styles.toneElevated,
  deep: styles.toneDeep,
  crema: styles.toneCrema, // superficie clara: texto bosque
  papel: styles.tonePapel, // superficie clara cálida: texto bosque
  albero: styles.toneAlbero, // banda a todo color: texto tinta
  tinta: styles.toneTinta, // casi negro verdoso
};
// Decoración de fondo opcional: 'glow' (resplandor de bronce) o 'grid' (cuadrícula de plano que se desvanece).
const DECORS = { glow: styles.decorGlow, grid: styles.decorGrid };

export default function Section({
  id,
  titleId,
  tone = 'base',
  decor = '',
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
    DECORS[decor] || '',
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
