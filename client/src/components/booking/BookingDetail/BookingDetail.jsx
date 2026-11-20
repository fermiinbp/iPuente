// Detalle de una reserva del cliente: código, sala, fecha y franja, importe, estado, cómo llegar y política de cancelación.
// No habla con la API: la página le pasa la reserva y `onCancel`. Cada rol verá aquí sus propias acciones.
import Button from '@/components/ui/Button/Button.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { formatLongDate, hasStarted } from '@/utils/dates.js';
import { formatPrice } from '@/utils/formatPrice.js';
import styles from './BookingDetail.module.css';

const pad = (hour) => String(hour).padStart(2, '0');

// Estado que se enseña: una reserva cancelada distingue si la canceló la persona o el espacio.
function badgeStatus(booking) {
  if (booking.estado !== 'CANCELLED') return booking.estado;
  return booking.canceladaPor === 'empresa' ? 'CANCELLED_BY_SPACE' : 'CANCELLED_BY_CLIENT';
}

export default function BookingDetail({ booking, onCancel }) {
  const canCancel = booking.estado === 'CONFIRMED' && !hasStarted(booking);
  const place = [booking.edificio?.direccion, booking.edificio?.ciudad].filter(Boolean).join(', ');
  const mapsQuery = `${booking.edificio?.nombre ?? ''} ${place}`.trim();
  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;

  return (
    <div className={styles.detail}>
      <div className={styles.head}>
        <div>
          {booking.codigo && <p className={styles.code}>Reserva {booking.codigo}</p>}
          <h1 className={styles.title}>{booking.sala?.nombre ?? 'Sala'}</h1>
        </div>
        <StatusBadge status={badgeStatus(booking)} kind="booking" />
      </div>

      {booking.estado === 'CANCELLED' && (
        <p className={styles.cancelled} role="status">
          {booking.canceladaPor === 'empresa'
            ? 'El espacio ha cancelado esta reserva.'
            : 'Has cancelado esta reserva.'}
          {booking.motivoCancelacion ? ` Motivo: ${booking.motivoCancelacion}` : ''}
        </p>
      )}

      <dl className={styles.facts}>
        <div>
          <dt>Fecha</dt>
          <dd>{formatLongDate(booking.fecha)}</dd>
        </div>
        <div>
          <dt>Horario</dt>
          <dd>
            {pad(booking.inicio)}:00 – {pad(booking.fin)}:00 ({booking.horas}{' '}
            {booking.horas === 1 ? 'hora' : 'horas'})
          </dd>
        </div>
        <div>
          <dt>Sala</dt>
          <dd>{[booking.sala?.codigo, booking.sala?.nombre].filter(Boolean).join(' · ') || '—'}</dd>
        </div>
        <div>
          <dt>Planta y edificio</dt>
          <dd>
            {[booking.planta?.nombre, booking.edificio?.nombre].filter(Boolean).join(' · ') || '—'}
          </dd>
        </div>
        <div>
          <dt>Precio por hora</dt>
          <dd>{formatPrice(booking.precioHora)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className={styles.total}>{formatPrice(booking.importe)}</dd>
        </div>
      </dl>

      <section className={styles.block} aria-labelledby="como-llegar">
        <h2 className={styles.subtitle} id="como-llegar">
          Cómo llegar
        </h2>
        {place ? (
          <>
            <p className={styles.text}>{place}</p>
            <a className={styles.link} href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Abrir en el mapa
              <span className={styles.srOnly}> (se abre en una pestaña nueva)</span>
            </a>
          </>
        ) : (
          <p className={styles.text}>La dirección del edificio no está disponible.</p>
        )}
      </section>

      <section className={styles.block} aria-labelledby="politica">
        <h2 className={styles.subtitle} id="politica">
          Política de cancelación
        </h2>
        <p className={styles.text}>
          Puedes cancelar mientras la reserva no haya empezado. Las horas quedan libres para otras
          personas.
        </p>
      </section>

      <div className={styles.actions}>
        {canCancel && (
          <Button variant="secondary" onClick={() => onCancel(booking)}>
            Cancelar reserva
          </Button>
        )}
        {booking.sala?.id && (
          <Button variant="ghost" to={`/rooms/${booking.sala.id}`}>
            Ver la sala
          </Button>
        )}
        <Button variant="ghost" disabled aria-describedby="factura-nota">
          Descargar factura
        </Button>
      </div>
      <p className={styles.note} id="factura-nota">
        La factura estará disponible cuando se active el pago online.
      </p>
    </div>
  );
}
