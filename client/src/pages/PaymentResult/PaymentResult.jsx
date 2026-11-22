// Vuelta desde Stripe (`?booking=<id>`). La URL no dice si se pagó: el estado que se enseña sale de la reserva que
// devuelve la API, que se sondea unos segundos porque la confirmación llega por webhook. Confirmada = pagada;
// caducada o cancelada = su estado; si sigue pendiente tras el tope, se dice que aún se está confirmando.
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useBookingPolling } from '@/hooks/useBookingPolling.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { formatLongDate } from '@/utils/dates.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './PaymentResult.module.css';

const pad = (hour) => String(hour).padStart(2, '0');

export default function PaymentResult() {
  const [params] = useSearchParams();
  const bookingId = params.get('booking');
  // `cancelado=1` solo cambia el texto y evita esperar al webhook: el estado sigue saliendo de la API.
  const abandoned = params.get('cancelado') === '1';
  const { phase, booking, error, retry } = useBookingPolling(
    bookingId,
    abandoned ? { maxMs: 0 } : undefined,
  );

  const checking = Boolean(bookingId) && phase === 'checking';
  const confirmed = phase === 'done' && ['CONFIRMED', 'COMPLETED'].includes(booking?.estado);
  const expired = phase === 'done' && booking?.estado === 'EXPIRED';
  const cancelled = phase === 'done' && booking?.estado === 'CANCELLED';
  const stillPending = phase === 'timeout';

  let title = 'No hay nada que mostrar';
  if (checking) title = abandoned ? 'Comprobando tu reserva…' : 'Estamos confirmando tu pago…';
  else if (bookingId && phase === 'error')
    title =
      error?.status === 404 ? 'No encontramos esta reserva' : 'No hemos podido comprobar el pago';
  else if (confirmed) title = 'Reserva confirmada';
  else if (expired) title = 'La reserva ha caducado';
  else if (cancelled) title = 'La reserva está cancelada';
  else if (stillPending)
    title = abandoned ? 'No has completado el pago' : 'Seguimos confirmando tu pago';
  usePageTitle(title);

  // El título se anuncia y recibe el foco cuando ya se sabe el resultado.
  const headingRef = useRef(null);
  useEffect(() => {
    if (!checking) headingRef.current?.focus();
  }, [checking, title]);

  const heading = (
    <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
      {title}
    </h1>
  );

  let content;
  if (!bookingId) {
    content = (
      <EmptyState title={title} action={<Button to="/my-bookings">Ir a mis reservas</Button>}>
        Entra en «Mis reservas» para ver el estado de tus reservas.
      </EmptyState>
    );
  } else if (checking) {
    content = (
      <>
        <Spinner label={title} />
        <p className={styles.text}>
          Puede tardar unos segundos. No cierres ni recargues esta página.
        </p>
      </>
    );
  } else if (stillPending && abandoned) {
    content = (
      <>
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        {heading}
        <p className={styles.text}>
          Tu reserva sigue pendiente y retenemos las horas durante un tiempo limitado. Puedes volver
          a intentar el pago o cancelarla desde «Mis reservas».
        </p>
        <div className={styles.actions}>
          <Button to={`/checkout/${bookingId}`}>Volver al pago</Button>
          <Button to="/my-bookings" variant="secondary">
            Ir a mis reservas
          </Button>
        </div>
      </>
    );
  } else if (phase === 'error') {
    const notFound = error?.status === 404;
    content = (
      <ErrorState
        error={error}
        home
        page
        code={notFound ? '404' : undefined}
        title={title}
        onRetry={notFound ? undefined : retry}
      >
        {notFound ? 'Puede que no exista o que no sea tuya.' : error?.message}
      </ErrorState>
    );
  } else if (confirmed) {
    content = (
      <>
        <span className={`${styles.icon} ${styles.iconOk}`} aria-hidden="true">
          ✓
        </span>
        {heading}
        <dl className={styles.facts}>
          <div>
            <dt>Sala</dt>
            <dd>
              {[booking.sala?.nombre, booking.planta?.nombre].filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
          <div>
            <dt>Fecha y franja</dt>
            <dd>
              {formatLongDate(booking.fecha)}, {pad(booking.inicio)}:00 – {pad(booking.fin)}:00
            </dd>
          </div>
          <div>
            <dt>Total pagado</dt>
            <dd>{priceLabel(booking.importe)}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button to="/my-bookings">Ver mis reservas</Button>
          <Button to="/" variant="secondary">
            Volver al inicio
          </Button>
        </div>
      </>
    );
  } else if (stillPending) {
    content = (
      <>
        <span className={styles.icon} aria-hidden="true">
          …
        </span>
        {heading}
        <p className={styles.text}>
          Todavía no hemos recibido la confirmación del pago. Puede tardar un poco más: si has
          pagado, tu reserva se confirmará sola. Comprueba de nuevo o míralo en «Mis reservas».
        </p>
        <div className={styles.actions}>
          <Button onClick={retry}>Comprobar de nuevo</Button>
          <Button to="/my-bookings" variant="secondary">
            Ir a mis reservas
          </Button>
        </div>
      </>
    );
  } else {
    // Caducada o cancelada.
    content = (
      <>
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        {heading}
        <p className={styles.text}>
          {expired
            ? 'No se completó el pago a tiempo y las horas han vuelto a quedar libres.'
            : 'Esta reserva ya no está activa y las horas han quedado libres.'}{' '}
          Si llegaste a pagar, te lo reembolsaremos.
        </p>
        <div className={styles.actions}>
          <Button to="/my-bookings">Ir a mis reservas</Button>
          <Button to={`/rooms/${booking.roomId}?date=${booking.fecha}`} variant="secondary">
            Ver la sala
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner} aria-live="polite">
        {content}
      </div>
    </div>
  );
}
