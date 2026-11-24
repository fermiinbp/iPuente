// Barra fija abajo en móvil con un importe y un botón (ficha de sala y «Revisa tu reserva», wireframes 04 móvil y 07b).
// Solo se ve por debajo de 900 px; en escritorio la acción va en la propia página. Mientras está en la página, el
// CSS le da al `body` un relleno inferior de su misma altura (`body:has(...)`), así la barra nunca tapa el final de
// la página ni el pie, sin que quien la usa tenga que reservar sitio. Se coloca al final del contenido de la página.
// `amount`: importe ya formateado («50,00 €»); `detail`: texto pequeño debajo («2 horas»); `action`: el botón
// (normalmente un Button primario). `label`: nombre accesible de la barra (por defecto «Resumen y acción»).
// El importe se anuncia al cambiar (aria-live) para que el lector de pantalla diga el nuevo total.
import styles from './StickyActionBar.module.css';

export default function StickyActionBar({
  amount,
  detail,
  action,
  label = 'Resumen y acción',
  className = '',
}) {
  return (
    <div
      className={[styles.bar, className].filter(Boolean).join(' ')}
      role="region"
      aria-label={label}
    >
      <div className={styles.summary} aria-live="polite" aria-atomic="true">
        {amount && <p className={styles.amount}>{amount}</p>}
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
