// Revisa tu reserva (/checkout/:bookingId): resumen antes de pagar. Solo se ve el resumen si la reserva
// es del usuario y está pendiente de pago; si ha caducado se ofrece reservar de nuevo (si la franja sigue libre).
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import BackLink from '@/components/ui/BackLink/BackLink.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getBooking } from '@/services/bookingsService.js';
import { createCheckout } from '@/services/paymentsService.js';
import { getAvailability } from '@/services/roomsService.js';
import { formatLongDate } from '@/utils/dates.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './BookingCheckout.module.css';

const pad = (hour) => String(hour).padStart(2, '0');
const PAY_WINDOW_MINUTES = 15;

// Tras caducar: ¿siguen libres todas las horas de la franja? (solo entonces se ofrece «Reservar de nuevo»).
function slotStillFree(booking, freeHours) {
  for (let hour = booking.inicio; hour < booking.fin; hour += 1) {
    if (!freeHours.includes(hour)) return false;
  }
  return true;
}

// Mensaje en español de cada error del pago.
function payErrorMessage(err) {
  switch (err.code) {
    case 'PAYMENT_IN_PROGRESS':
      return 'Ya hay un pago en marcha para esta reserva. Espera unos segundos e inténtalo de nuevo.';
    case 'BOOKING_STARTED':
      return 'La reserva ya ha empezado y no se puede pagar.';
    case 'BOOKING_EXPIRED':
      return 'Se ha agotado el tiempo para pagar esta reserva.';
    case 'BOOKING_NOT_PENDING':
      return 'Esta reserva ya no está pendiente de pago.';
    case 'PAYOUTS_REQUIRED':
      return 'Esta sala no puede cobrarse online ahora mismo. Prueba con otra sala.';
    case 'BUSY':
      return 'Hay mucha actividad en este momento. Inténtalo de nuevo.';
    case 'PAYMENTS_UNAVAILABLE':
      return 'El pago online no está disponible ahora mismo. Tu reserva sigue guardada: inténtalo en unos minutos.';
    case 'PAYMENTS_ERROR':
      return 'No hemos podido conectar con el servicio de pago. No se ha hecho ningún cargo; inténtalo de nuevo.';
    default:
      return err.message;
  }
}

export default function BookingCheckout() {
  usePageTitle('Revisa tu reserva');
  const { bookingId } = useParams();
  const {
    data: booking,
    error,
    loading,
    reload,
  } = useFetch((signal) => getBooking(bookingId, { signal }), bookingId);
  const expired = booking?.estado === 'EXPIRED';
  // Solo se piden las horas libres cuando la reserva ha caducado.
  const { data: hours } = useFetch(
    (signal) =>
      expired
        ? getAvailability(booking.roomId, { fecha: booking.fecha, signal }).catch(() => null)
        : Promise.resolve(null),
    `${bookingId}|${expired}`,
  );

  const [paying, setPaying] = useState(false);
  // Cerrojo inmediato: el estado se actualiza al repintar y un doble clic podría colarse antes.
  const payLock = useRef(false);
  const [payError, setPayError] = useState('');

  // Al volver atrás desde Stripe el navegador puede restaurar la página con el botón aún cargando.
  useEffect(() => {
    function handlePageShow(event) {
      if (!event.persisted) return;
      payLock.current = false;
      setPaying(false);
      reload();
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [reload]);

  async function handlePay() {
    if (payLock.current) return;
    payLock.current = true;
    setPaying(true);
    setPayError('');
    try {
      const { url } = await createCheckout(bookingId);
      // Solo se redirige a la página de pago de Stripe, siempre por https.
      const target = URL.canParse(url ?? '') ? new URL(url) : null;
      if (target?.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com')
        throw new Error('No hemos podido abrir la página de pago.');
      window.location.assign(target.href);
    } catch (err) {
      setPayError(payErrorMessage(err));
      // Si la reserva ya no se puede pagar, se recarga para enseñar su estado real.
      if (['BOOKING_EXPIRED', 'BOOKING_NOT_PENDING', 'BOOKING_STARTED'].includes(err.code))
        reload();
      payLock.current = false;
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.status}>
        <Spinner label="Cargando tu reserva…" />
      </div>
    );
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <div className={styles.status}>
        <ErrorState
          error={error}
          home
          page
          code={notFound ? '404' : undefined}
          title={notFound ? 'No encontramos esta reserva' : undefined}
          onRetry={notFound ? undefined : reload}
        >
          {notFound ? 'Puede que no exista o que no sea tuya.' : error.message}
        </ErrorState>
      </div>
    );
  }

  const roomTo = `/rooms/${booking.roomId}?date=${booking.fecha}`;

  // Reserva que no necesita pago (ya confirmada, cancelada…): no se enseña el resumen de pago.
  if (booking.estado !== 'PENDING_PAYMENT' && !expired) {
    return (
      <div className={styles.status}>
        <EmptyState
          title={
            booking.estado === 'CONFIRMED'
              ? 'Esta reserva ya está pagada'
              : 'Esta reserva no se puede pagar'
          }
          action={<Button to={`/my-bookings/${booking.id}`}>Ver la reserva</Button>}
        >
          Puedes consultarla en «Mis reservas».
        </EmptyState>
      </div>
    );
  }

  if (expired) {
    const canRetry = hours ? slotStillFree(booking, hours.horasLibres ?? []) : false;
    return (
      <div className={styles.status}>
        <EmptyState
          title="Tiempo agotado"
          actions={
            <>
              {canRetry && <Button to={roomTo}>Reservar de nuevo</Button>}
              <Button to={roomTo} variant="secondary">
                Ver otras horas
              </Button>
            </>
          }
        >
          Pasaron {PAY_WINDOW_MINUTES} minutos sin pagar y las horas han vuelto a quedar libres.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackLink to={roomTo}>Volver a la sala</BackLink>
        <h1 className={styles.title}>Revisa tu reserva</h1>

        <div className={styles.layout}>
          <div className={styles.left}>
            <dl className={styles.facts}>
              <div>
                <dt>Sala</dt>
                <dd>
                  <Link to={`/rooms/${booking.roomId}`}>{booking.sala?.nombre ?? 'Sala'}</Link>
                </dd>
              </div>
              <div>
                <dt>Planta y edificio</dt>
                <dd>
                  {[booking.planta?.nombre, booking.edificio?.nombre].filter(Boolean).join(' · ') ||
                    '—'}
                </dd>
              </div>
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
            </dl>

            <p className={styles.policy}>
              Puedes cancelar mientras la reserva no haya empezado. Tienes {PAY_WINDOW_MINUTES}{' '}
              minutos para pagar: después las horas vuelven a quedar libres.
            </p>
          </div>

          <aside className={styles.priceBox} aria-labelledby="precio-titulo">
            <h2 className={styles.priceTitle} id="precio-titulo">
              Precio
            </h2>
            <dl className={styles.prices}>
              <div>
                <dt>
                  {booking.precioHora === 0 ? '' : `${priceLabel(booking.precioHora)} × `}
                  {booking.horas} {booking.horas === 1 ? 'hora' : 'horas'}
                </dt>
                <dd>{priceLabel(booking.importe)}</dd>
              </div>
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>{priceLabel(booking.importe)}</dd>
              </div>
            </dl>

            {payError && <Alert type="error">{payError}</Alert>}

            <Button size="lg" loading={paying} onClick={handlePay}>
              Ir a pagar
            </Button>
            <p className={styles.secure}>Pago seguro con Stripe</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
