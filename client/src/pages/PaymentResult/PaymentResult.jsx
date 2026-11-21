// Vuelta desde el pago (`?booking=<id>`). El estado que se enseña sale de la reserva que devuelve la API, nunca de un
// parámetro de la URL: confirmada = pagada; pendiente de pago = el pago no se completó.
// Todavía no hay pago online: las reservas nacen confirmadas. La pantalla queda lista para cuando lo haya.
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getBooking } from '@/services/bookingsService.js';
import { formatLongDate } from '@/utils/dates.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './PaymentResult.module.css';

const pad = (hour) => String(hour).padStart(2, '0');

export default function PaymentResult() {
  const [params] = useSearchParams();
  const bookingId = params.get('booking');
  const {
    data: booking,
    error,
    loading,
    reload,
  } = useFetch(
    (signal) => (bookingId ? getBooking(bookingId, { signal }) : Promise.resolve(null)),
    bookingId ?? 'none',
  );

  const confirmed = booking?.estado === 'CONFIRMED';
  const pending = booking?.estado === 'PENDING_PAYMENT';
  let title = 'No hay nada que mostrar';
  if (loading) title = 'Comprobando tu pago…';
  else if (error)
    title =
      error.status === 404 ? 'No encontramos esta reserva' : 'No hemos podido comprobar el pago';
  else if (confirmed) title = 'Reserva confirmada';
  else if (pending) title = 'El pago no se ha completado';
  usePageTitle(title);

  // El título se anuncia y recibe el foco cuando ya se sabe el resultado.
  const headingRef = useRef(null);
  useEffect(() => {
    if (!loading) headingRef.current?.focus();
  }, [loading, title]);

  let content;
  if (loading) {
    content = <Spinner label="Comprobando tu pago…" />;
  } else if (error) {
    const notFound = error.status === 404;
    content = (
      <ErrorState
        error={error}
        home
        page
        code={notFound ? '404' : undefined}
        title={title}
        onRetry={notFound ? undefined : reload}
      >
        {notFound ? 'Puede que no exista o que no sea tuya.' : error.message}
      </ErrorState>
    );
  } else if (confirmed) {
    content = (
      <>
        <span className={`${styles.icon} ${styles.iconOk}`} aria-hidden="true">
          ✓
        </span>
        <h1 className={styles.title} ref={headingRef} tabIndex={-1} role="status">
          {title}
        </h1>
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
  } else if (pending) {
    content = (
      <>
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        <h1 className={styles.title} ref={headingRef} tabIndex={-1} role="status">
          {title}
        </h1>
        <p className={styles.text}>
          No se ha hecho ningún cargo. Tu reserva sigue guardada 15 minutos.
        </p>
        <div className={styles.actions}>
          <Button to={`/checkout/${booking.id}`}>Intentar de nuevo</Button>
          <Button to={`/rooms/${booking.roomId}?date=${booking.fecha}`} variant="secondary">
            Cambiar la reserva
          </Button>
        </div>
      </>
    );
  } else {
    content = (
      <EmptyState title={title} action={<Button to="/my-bookings">Ir a mis reservas</Button>}>
        Entra en «Mis reservas» para ver el estado de tus reservas.
      </EmptyState>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>{content}</div>
    </div>
  );
}
