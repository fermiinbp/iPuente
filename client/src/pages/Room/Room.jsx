// Ficha de sala con galería, equipamiento, disponibilidad y reserva.
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import Breadcrumbs from '@/components/ui/Breadcrumbs/Breadcrumbs.jsx';
import BookingForm from '@/components/booking/BookingForm/BookingForm.jsx';
import AmenitiesList from '@/components/room/AmenitiesList/AmenitiesList.jsx';
import RoomGallery from '@/components/room/RoomGallery/RoomGallery.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Reveal from '@/components/ui/Reveal/Reveal.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StickyActionBar from '@/components/ui/StickyActionBar/StickyActionBar.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { createBooking } from '@/services/bookingsService.js';
import { getAvailability, getRoom } from '@/services/roomsService.js';
import { attendeesError, barSummary } from '@/utils/bookingForm.js';
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

  // Solo en desarrollo y sin API, las salas de ejemplo de la landing se ven con datos de muestra.
  // En producción, un fallo se enseña como error: nunca una sala inventada que no se puede reservar.
  const demo = import.meta.env.DEV && roomFetch.error ? demoRoom(roomId) : null;
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
      if (booking.estado === 'PENDING_PAYMENT') {
        navigate(`/checkout/${encodeURIComponent(booking.id)}`);
      } else {
        navigate(`/my-bookings/${booking.id}`, { state: { created: true } });
      }
    } catch (error) {
      const messages = {
        PAYOUTS_REQUIRED: 'Esta sala no puede cobrarse online ahora mismo. Prueba con otra sala.',
        PAYMENTS_UNAVAILABLE:
          'El pago online no está disponible ahora mismo, así que no podemos crear la reserva. Inténtalo más tarde.',
        BUSY: 'Hay mucha actividad en este momento. Inténtalo de nuevo.',
      };
      setBookingError(messages[error.code] || error.message);
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
  const hasPhotos = (room.fotos ?? []).length > 0;
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
  // Barra fija de móvil: mismo total y mismas reglas que el botón del formulario (`BookingForm`).
  const bar = barSummary({ selection: activeSelection, pricePerHour: room.precioHora ?? 0 });
  const canReserve = Boolean(activeSelection) && !attendeesError(attendees, room.capacidad ?? null);

  return (
    <div className={styles.page} data-superficie="clara">
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
          <Reveal as="h1" className={styles.title} text={room.nombre} />
          {room.reservable && (
            <a className={styles.jump} href="#reserva-titulo">
              Reservar esta sala<span aria-hidden="true"> ↓</span>
            </a>
          )}

          {/* Sin fotos no se reserva un cuadro vacío: los datos clave suben y ocupan su sitio. */}
          {hasPhotos && <RoomGallery photos={room.fotos} name={room.nombre} />}

          <dl className={`${styles.facts} ${hasPhotos ? '' : styles.factsBand}`}>
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

        <aside className={styles.booking} aria-labelledby="reserva-titulo" data-superficie="oscura">
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

      {/* Solo en móvil (< 900 px). El botón está fuera del formulario y se asocia a él con `form`. */}
      {room.reservable && (
        <StickyActionBar
          label="Resumen de la reserva"
          amount={bar.amount}
          detail={bar.detail}
          action={
            <Button type="submit" form="reserva-form" loading={submitting} disabled={!canReserve}>
              {user ? 'Reservar' : 'Iniciar sesión'}
            </Button>
          }
        />
      )}
    </div>
  );
}
