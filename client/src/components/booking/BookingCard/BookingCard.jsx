// Fila de una reserva en «Mis reservas»: sala, fecha, franja, importe y estado. Solo se puede cancelar
// una reserva confirmada que todavía no ha empezado.
import { Link } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { formatLongDate } from '@/utils/dates.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './BookingCard.module.css';

const pad = (hour) => String(hour).padStart(2, '0');

function hasStarted({ fecha, inicio }) {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(year, month - 1, day, inicio).getTime() <= Date.now();
}

export default function BookingCard({ booking, onCancel }) {
  const canCancel = booking.estado === 'CONFIRMED' && !hasStarted(booking);
  const name = booking.sala?.nombre ?? 'Sala';

  return (
    <article className={styles.card} aria-label={`Reserva de ${name}`}>
      <div className={styles.main}>
        <h3 className={styles.name}>
          <Link to={`/rooms/${booking.roomId}`}>{name}</Link>
        </h3>
        <p className={styles.when}>
          {formatLongDate(booking.fecha)} · {pad(booking.inicio)}:00 – {pad(booking.fin)}:00 (
          {booking.horas} {booking.horas === 1 ? 'hora' : 'horas'})
        </p>
      </div>
      <div className={styles.side}>
        <StatusBadge status={booking.estado} kind="booking" />
        <p className={styles.amount}>{formatPrice(booking.importe)}</p>
        {canCancel && (
          <Button variant="ghost" onClick={() => onCancel(booking)}>
            Cancelar
          </Button>
        )}
      </div>
    </article>
  );
}
