// Ficha de sala con galería, equipamiento, disponibilidad y reserva.
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import Breadcrumbs from '@/components/ui/Breadcrumbs/Breadcrumbs.jsx';
import BookingForm from '@/components/booking/BookingForm/BookingForm.jsx';
import AmenitiesList from '@/components/room/AmenitiesList/AmenitiesList.jsx';
import RoomGallery from '@/components/room/RoomGallery/RoomGallery.jsx';
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
  const people = searchParams.get('people') ?? '';

  // La franja viaja en la URL (start y end) para que siga elegida tras pasar por el login.
  const [selection, setSelection] = useState(() => {
    const inicio = Number(searchParams.get('start'));
    const fin = Number(searchParams.get('end'));
    return Number.isInteger(inicio) && Number.isInteger(fin) && inicio > 0 && fin > inicio
      ? { inicio, fin }
      : null;
  });
  const [attendees, setAttendees] = useState(people);
  const [submitting, setSubmitting] = useState(false);
  // Cerrojo inmediato contra el doble clic en «Reservar».
  const submitLock = useRef(false);
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

  // Si las horas elegidas ya no están libres (otra fecha, otra reserva), la selección se descarta.
  const hoursReady = demo || (!hours.loading && !hours.error);
  const selectionFree =
    !selection ||
    !hoursReady ||
    Array.from({ length: selection.fin - selection.inicio }, (_, i) => selection.inicio + i).every(
      (hour) => freeHours.includes(hour),
    );
  const activeSelection = selectionFree ? selection : null;

  function keepParams(extra = {}) {
    const params = new URLSearchParams();
    params.set('date', extra.date ?? fecha);
    if (people) params.set('people', people);
    return params;
  }

  function handleDateChange(next) {
    setSelection(null);
    setBookingError('');
    const params = keepParams();
    if (next) params.set('date', next);
    else params.delete('date');
    setSearchParams(params, { replace: true });
  }

  async function handleSubmit() {
    if (submitLock.current || !activeSelection) return;
    if (!user) {
      const params = keepParams();
      params.set('start', String(activeSelection.inicio));
      params.set('end', String(activeSelection.fin));
      navigate('/login', { state: { from: `${location.pathname}?${params.toString()}` } });
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setBookingError('');
    try {
      const booking = await createBooking({
        roomId,
        fecha,
        inicio: activeSelection.inicio,
        fin: activeSelection.fin,
      });
      navigate(`/my-bookings/${booking.id}`, { state: { created: true } });
    } catch (error) {
      setBookingError(error.message);
      if (error.code === 'SLOT_TAKEN') {
        setSelection(null);
        hours.reload();
      }
    } finally {
      submitLock.current = false;
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
          error={roomFetch.error}
          home
          page
          code={notFound ? '404' : undefined}
          title={notFound ? 'No encontramos esta sala' : undefined}
          onRetry={notFound ? undefined : roomFetch.reload}
        >
          {notFound
            ? 'Puede que ya no esté publicada o que el enlace sea incorrecto.'
            : roomFetch.error?.message}
        </ErrorState>
      </div>
    );
  }

  const place = [room.edificio?.direccion, room.edificio?.ciudad].filter(Boolean).join(', ');
  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${room.edificio?.nombre ?? ''} ${place}`.trim())}`
    : null;
  const where = [room.edificio?.nombre, room.planta?.nombre].filter(Boolean).join(' · ');
  const keep = keepParams().toString();
  const buildingTo = `/buildings/${room.edificio.id}?${keep}`;
  const floorTo = room.planta
    ? `/buildings/${room.edificio.id}/floors/${room.planta.id}?${keep}`
    : null;
  const backTo = floorTo ?? buildingTo;
  const crumbs = [
    { label: room.edificio.nombre ?? 'Edificio', to: buildingTo },
    ...(room.planta ? [{ label: room.planta.nombre, to: floorTo }] : []),
    { label: room.nombre },
  ];

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
          <Breadcrumbs items={crumbs} />
          {where && <p className={styles.eyebrow}>{where}</p>}
          <h1 className={styles.title}>{room.nombre}</h1>
          {room.reservable && (
            <a className={styles.jump} href="#reserva-titulo">
              Reservar esta sala<span aria-hidden="true"> ↓</span>
            </a>
          )}

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
              <dd>
                {room.gratis || room.precioHora === 0
                  ? 'Gratis'
                  : room.precioHora != null
                    ? `${formatPrice(room.precioHora)} / hora`
                    : '—'}
              </dd>
            </div>
          </dl>

          {room.descripcion && <p className={styles.description}>{room.descripcion}</p>}

          <h2 className={styles.subtitle}>Equipamiento</h2>
          <AmenitiesList items={room.equipamiento} />

          {place && (
            <section aria-labelledby="como-llegar">
              <h2 className={styles.subtitle} id="como-llegar">
                Cómo llegar
              </h2>
              <p className={styles.place}>{place}</p>
              <a
                className={styles.mapLink}
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en el mapa
                <span className={styles.srOnly}> (se abre en una pestaña nueva)</span>
              </a>
            </section>
          )}
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
            selection={activeSelection}
            onSelectionChange={setSelection}
            attendees={attendees}
            onAttendeesChange={setAttendees}
            capacity={room.capacidad ?? null}
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
