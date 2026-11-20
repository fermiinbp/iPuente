// Resumen de la reserva: día, franja, precio por hora y total. Es una previsión: el importe final
// lo calcula la API al reservar (el precio que se muestra aquí no se envía).
import { formatLongDate } from '@/utils/dates.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './BookingSummary.module.css';

const pad = (hour) => String(hour).padStart(2, '0');

export default function BookingSummary({ fecha, selection, pricePerHour }) {
  if (!selection) {
    return <p className={styles.empty}>Elige las horas que necesitas para ver el total.</p>;
  }
  const hours = selection.fin - selection.inicio;
  return (
    <dl className={styles.summary} aria-live="polite">
      <div>
        <dt>Día</dt>
        <dd>{formatLongDate(fecha)}</dd>
      </div>
      <div>
        <dt>Franja</dt>
        <dd>
          {pad(selection.inicio)}:00 – {pad(selection.fin)}:00 ({hours}{' '}
          {hours === 1 ? 'hora' : 'horas'})
        </dd>
      </div>
      <div>
        <dt>Precio por hora</dt>
        <dd>{formatPrice(pricePerHour)}</dd>
      </div>
      <div className={styles.total}>
        <dt>Total</dt>
        <dd>{formatPrice(pricePerHour * hours)}</dd>
      </div>
    </dl>
  );
}
