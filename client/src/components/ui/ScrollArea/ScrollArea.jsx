// Zona con scroll vertical de los paneles (SidePanel y lista de salas del editor): barra fina en bronce con forma de
// pastilla, separada del contenido y con su hueco reservado para que nada se mueva de lado al aparecer.
// `as` cambia la etiqueta (p. ej. "ul" para una lista) sin añadir capas. `className` solo debe poner el tamaño y la
// posición (`flex: 1`, `max-height`…): el padding, el margin y el overflow los pone ScrollArea. El resto de props
// (`ref`, `id`, `aria-*`…) van al elemento.
import styles from './ScrollArea.module.css';

export default function ScrollArea({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag {...rest} className={[styles.scrollArea, className].filter(Boolean).join(' ')}>
      {children}
    </Tag>
  );
}
