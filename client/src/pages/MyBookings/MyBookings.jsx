// Reservas del cliente: próximas y pasadas, con cancelación.
import { useState } from 'react';
import BookingCard from '@/components/booking/BookingCard/BookingCard.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { cancelBooking, getMyBookings } from '@/services/bookingsService.js';
import { formatLongDate } from '@/utils/dates.js';
import styles from './MyBookings.module.css';

export default function MyBookings() {
  usePageTitle('Mis reservas');
  const { data, error, loading, reload } = useFetch((signal) => getMyBookings({ signal }), 'mine');
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [notice, setNotice] = useState('');

  function closeModal() {
    setToCancel(null);
    setCancelError('');
  }

  async function confirmCancel() {
    setCancelling(true);
    setCancelError('');
    try {
      await cancelBooking(toCancel.id);
      setNotice(`Reserva del ${formatLongDate(toCancel.fecha)} cancelada.`);
      setToCancel(null);
      reload();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  // Las reservas pendientes de pago que ya han caducado no se enseñan.
  const visible = (list) => list.filter((booking) => booking.estado !== 'EXPIRED');
  const upcoming = data ? visible(data.proximas) : [];
  const past = data ? visible(data.pasadas) : [];

  let content;
  if (loading) {
    content = <Spinner label="Cargando tus reservas…" />;
  } else if (error) {
    content = (
      <ErrorState error={error} home onRetry={reload}>
        {error.message}
      </ErrorState>
    );
  } else if (upcoming.length === 0 && past.length === 0) {
    content = (
      <EmptyState
        title="Aún no tienes reservas"
        action={<Button to="/search">Buscar salas</Button>}
      >
        Elige un edificio, una planta y una sala, y reserva las horas que necesites.
      </EmptyState>
    );
  } else {
    content = (
      <>
        <section aria-labelledby="proximas-titulo">
          <h2 className={styles.subtitle} id="proximas-titulo">
            Próximas ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <p className={styles.none}>No tienes reservas próximas.</p>
          ) : (
            <ul className={styles.list}>
              {upcoming.map((booking) => (
                <li key={booking.id}>
                  <BookingCard booking={booking} onCancel={setToCancel} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {past.length > 0 && (
          <section aria-labelledby="pasadas-titulo">
            <h2 className={styles.subtitle} id="pasadas-titulo">
              Pasadas ({past.length})
            </h2>
            <ul className={styles.list}>
              {past.map((booking) => (
                <li key={booking.id}>
                  <BookingCard booking={booking} onCancel={setToCancel} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Mis reservas</h1>
        {notice && <Alert type="success">{notice}</Alert>}
        {content}
      </div>

      <ConfirmModal
        open={Boolean(toCancel)}
        title="¿Cancelar esta reserva?"
        text={
          toCancel
            ? `${toCancel.sala?.nombre ?? 'La sala'}, ${formatLongDate(toCancel.fecha)}. Las horas quedarán libres para otras personas.`
            : ''
        }
        confirmLabel="Cancelar reserva"
        loading={cancelling}
        error={cancelError}
        onConfirm={confirmCancel}
        onCancel={closeModal}
      />
    </div>
  );
}
