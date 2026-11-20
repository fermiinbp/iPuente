// Reservas del cliente: próximas y pasadas, con cancelación.
import { useState } from 'react';
import BookingCard from '@/components/booking/BookingCard/BookingCard.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import SegmentedControl from '@/components/ui/SegmentedControl/SegmentedControl.jsx';
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
  const [tab, setTab] = useState('proximas');

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
    const shown = tab === 'pasadas' ? past : upcoming;
    content = (
      <>
        <SegmentedControl
          label="Mostrar reservas"
          name="mis-reservas-tab"
          value={tab}
          onChange={(event) => setTab(event.target.value)}
          options={[
            { value: 'proximas', label: `Próximas (${upcoming.length})` },
            { value: 'pasadas', label: `Pasadas (${past.length})` },
          ]}
        />
        <section aria-label={tab === 'pasadas' ? 'Reservas pasadas' : 'Reservas próximas'}>
          {shown.length === 0 ? (
            <p className={styles.none}>
              {tab === 'pasadas' ? 'No tienes reservas pasadas.' : 'No tienes reservas próximas.'}
            </p>
          ) : (
            <ul className={styles.list}>
              {shown.map((booking) => (
                <li key={booking.id}>
                  <BookingCard booking={booking} onCancel={setToCancel} />
                </li>
              ))}
            </ul>
          )}
        </section>
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
        onConfirm={confirmCancel}
        onClose={closeModal}
      >
        {cancelError && <Alert type="error">{cancelError}</Alert>}
      </ConfirmModal>
    </div>
  );
}
