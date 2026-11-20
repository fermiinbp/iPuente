// Ficha de sala con galería, equipamiento, disponibilidad y reserva.
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import BookingForm from '@/components/booking/BookingForm/BookingForm.jsx';
import AmenitiesList from '@/components/room/AmenitiesList/AmenitiesList.jsx';
import RoomGallery from '@/components/room/RoomGallery/RoomGallery.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { createBooking } from '@/services/bookingsService.js';
import { getAvailability, getRoom } from '@/services/roomsService.js';
import { todayString } from '@/utils/dates.js';
import { formatPrice } from '@/utils/formatPrice.js';
import { DEMO_FREE_HOURS, demoRoom } from './demoRoom.js';
import styles from './Room.module.css';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fecha = searchParams.get('date') || todayString();

  const [selection, setSelection] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const roomFetch = useFetch((signal) => getRoom(roomId, { signal }), roomId);
  const hours = useFetch(
    (signal) => getAvailability(roomId, { fecha, signal }),
    `${roomId}|${fecha}`,
  );

  // Sin API, las salas de ejemplo de la landing se ven con datos de muestra.
  const demo = roomFetch.error ? demoRoom(roomId) : null;
  const room = roomFetch.data ?? demo;
  const freeHours = demo ? DEMO_FREE_HOURS : (hours.data?.horasLibres ?? []);
  usePageTitle(room?.nombre ?? 'Sala');

  function handleDateChange(next) {
    setSelection(null);
    setBookingError('');
    setSearchParams(next ? { date: next } : {}, { replace: true });
  }

  async function handleSubmit() {
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    setSubmitting(true);
    setBookingError('');
    try {
      await createBooking({ roomId, fecha, inicio: selection.inicio, fin: selection.fin });
      navigate('/my-bookings');
    } catch (error) {
      setBookingError(error.message);
      if (error.code === 'SLOT_TAKEN') {
        setSelection(null);
        hours.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (roomFetch.loading) {
    return (
      <div className={styles.status}>
        <Spinner label="Cargando la sala…" />
      </div>
    );
  }

  if (!room) {
    const notFound = roomFetch.error?.status === 404;
    return (
      <div className={styles.status}>
        <ErrorState
          title={notFound ? 'No encontramos esta sala' : undefined}
          onRetry={notFound ? undefined : roomFetch.reload}
        >
          {notFound
            ? 'Puede que ya no esté publicada o que el enlace sea incorrecto.'
            : roomFetch.error?.message}
        </ErrorState>
        <Button to="/" variant="secondary">
          Volver al inicio
        </Button>
      </div>
    );
  }

  const where = [room.edificio?.nombre, room.planta?.nombre].filter(Boolean).join(' · ');
  const backTo = room.planta
    ? `/buildings/${room.edificio.id}/floors/${room.planta.id}?date=${encodeURIComponent(fecha)}`
    : `/buildings/${room.edificio.id}?date=${encodeURIComponent(fecha)}`;

  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true">
        <span className={styles.blobA} />
        <span className={styles.blobB} />
      </div>

      <div className={styles.inner}>
        <div className={styles.main}>
          <Link className={styles.back} to={backTo}>
            <span aria-hidden="true">←</span> Volver al plano
          </Link>
          {where && <p className={styles.eyebrow}>{where}</p>}
          <h1 className={styles.title}>{room.nombre}</h1>

          <RoomGallery photos={room.fotos} name={room.nombre} />

          <dl className={styles.facts}>
            <div>
              <dt>Capacidad</dt>
              <dd>{room.capacidad ? `${room.capacidad} personas` : '—'}</dd>
            </div>
            {room.m2 ? (
              <div>
                <dt>Superficie</dt>
                <dd>{room.m2} m²</dd>
              </div>
            ) : null}
            <div>
              <dt>Precio</dt>
              <dd>{room.precioHora != null ? `${formatPrice(room.precioHora)} / hora` : '—'}</dd>
            </div>
          </dl>

          {room.descripcion && <p className={styles.description}>{room.descripcion}</p>}

          <h2 className={styles.subtitle}>Equipamiento</h2>
          <AmenitiesList items={room.equipamiento} />
        </div>

        <aside className={styles.booking} aria-labelledby="reserva-titulo">
          <h2 className={styles.bookingTitle} id="reserva-titulo">
            Reserva esta sala
          </h2>
          {roomFetch.error && demo && (
            <p className={styles.demoNote} role="note">
              Estás viendo datos de ejemplo: la API no está disponible.
            </p>
          )}
          <BookingForm
            fecha={fecha}
            onDateChange={handleDateChange}
            freeHours={freeHours}
            loadingHours={!demo && hours.loading}
            hoursError={!demo && hours.error ? hours.error.message : ''}
            selection={selection}
            onSelectionChange={setSelection}
            pricePerHour={room.precioHora ?? 0}
            bookable={room.reservable}
            loggedIn={Boolean(user)}
            submitting={submitting}
            error={bookingError}
            onSubmit={handleSubmit}
          />
        </aside>
      </div>
    </div>
  );
}
