// Detalle de una reserva del cliente (/my-bookings/:bookingId), con cancelación.
// Tras reservar se llega aquí con `state.created` y se avisa de que la reserva está confirmada.
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import BookingDetail from '@/components/booking/BookingDetail/BookingDetail.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import BackLink from '@/components/ui/BackLink/BackLink.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { cancelBooking, getBooking } from '@/services/bookingsService.js';
import { cancelNotice } from '@/utils/bookingDetail.js';
import { formatLongDate } from '@/utils/dates.js';
import styles from './BookingDetailPage.module.css';

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const location = useLocation();
  const {
    data: booking,
    error,
    loading,
    reload,
  } = useFetch((signal) => getBooking(bookingId, { signal }), bookingId);
  usePageTitle(
    booking?.sala?.nombre ? `Reserva de ${booking.sala.nombre}` : 'Detalle de la reserva',
  );

  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [notice, setNotice] = useState(null);

  function closeModal() {
    setToCancel(null);
    setCancelError('');
  }

  async function confirmCancel() {
    setCancelling(true);
    setCancelError('');
    try {
      const result = await cancelBooking(toCancel.id);
      setNotice(cancelNotice(formatLongDate(toCancel.fecha), result));
      setToCancel(null);
      reload();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  let content;
  if (loading) {
    content = <Spinner label="Cargando la reserva…" />;
  } else if (error) {
    const notFound = error.status === 404;
    content = (
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
    );
  } else {
    content = (
      <>
        {location.state?.created && !notice && (
          <Alert type="success">Reserva confirmada. Te esperamos.</Alert>
        )}
        {notice && <Alert type={notice.type}>{notice.text}</Alert>}
        <BookingDetail booking={booking} onCancel={setToCancel} />
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackLink to="/my-bookings">Volver a mis reservas</BackLink>
        {content}
        {error && (
          <div>
            <Button to="/my-bookings" variant="secondary">
              Ir a mis reservas
            </Button>
          </div>
        )}
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
        onConfirm={confirmCancel}
        onClose={closeModal}
      >
        {cancelError && <Alert type="error">{cancelError}</Alert>}
      </ConfirmModal>
    </div>
  );
}
