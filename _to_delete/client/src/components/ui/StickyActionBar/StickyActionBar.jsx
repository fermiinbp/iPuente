// Barra fija abajo en móvil con un importe y un botón (ficha de sala y «Revisa tu reserva», wireframes 04 móvil y 07b).
// Solo se ve por debajo de 900 px; en escritorio la acción va en la propia página. Pinta además un hueco con la
// misma altura en el flujo de la página, así la barra nunca tapa el final del contenido sin que quien la usa tenga
// que reservar sitio. Se coloca al final del contenido de la página.
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
    <>
      <div className={styles.spacer} aria-hidden="true" />
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
    </>
  );
}
