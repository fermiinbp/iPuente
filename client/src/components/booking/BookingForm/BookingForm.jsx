// Formulario de reserva: fecha, horas libres, resumen y botón. No habla con la API: avisa a la página
// con onSubmit y ella crea la reserva.
import AvailabilityCalendar from '@/components/room/AvailabilityCalendar/AvailabilityCalendar.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { todayString } from '@/utils/dates.js';
import BookingSummary from '../BookingSummary/BookingSummary.jsx';
import styles from './BookingForm.module.css';

export default function BookingForm({
  fecha,
  onDateChange,
  freeHours,
  loadingHours,
  hoursError,
  selection,
  onSelectionChange,
  attendees = '',
  onAttendeesChange,
  capacity = null,
  pricePerHour,
  bookable,
  loggedIn,
  submitting,
  error,
  onSubmit,
}) {
  if (!bookable) {
    return <Alert type="info">Esta sala no se puede reservar online.</Alert>;
  }

  // Asistentes: opcional, pero si se escribe debe ser 1 o más y no pasar de la capacidad de la sala.
  const count = attendees === '' ? null : Number(attendees);
  let attendeesError = '';
  if (count !== null && !(Number.isInteger(count) && count >= 1)) {
    attendeesError = 'Indica al menos 1 asistente.';
  } else if (count !== null && capacity && count > capacity) {
    attendeesError = `La sala admite como máximo ${capacity} personas.`;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selection && !attendeesError && !submitting) onSubmit();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Input
        label="Fecha"
        type="date"
        name="date"
        variant="boxed"
        value={fecha}
        min={todayString()}
        onChange={(event) => onDateChange(event.target.value)}
      />

      {loadingHours ? (
        <Spinner label="Cargando las horas libres…" />
      ) : hoursError ? (
        <Alert type="error">{hoursError}</Alert>
      ) : freeHours.length === 0 ? (
        <Alert type="info">No quedan horas libres este día. Prueba con otra fecha.</Alert>
      ) : (
        <>
          <AvailabilityCalendar
            freeHours={freeHours}
            selection={selection}
            onChange={onSelectionChange}
            disabled={submitting}
          />
          <p className={styles.legend}>Gris = ocupada. Se seleccionan horas seguidas.</p>
        </>
      )}

      <Input
        label="Asistentes"
        type="number"
        name="attendees"
        variant="boxed"
        min="1"
        max={capacity ?? undefined}
        step="1"
        inputMode="numeric"
        placeholder={capacity ? `Hasta ${capacity}` : undefined}
        value={attendees}
        onChange={(event) => onAttendeesChange?.(event.target.value)}
        error={attendeesError}
      />

      <BookingSummary fecha={fecha} selection={selection} pricePerHour={pricePerHour} />

      {error && <Alert type="error">{error}</Alert>}

      <Button type="submit" loading={submitting} disabled={!selection || Boolean(attendeesError)}>
        {loggedIn ? 'Reservar' : 'Inicia sesión para reservar'}
      </Button>
      {!loggedIn && <p className={styles.loginHint}>Necesitas iniciar sesión para reservar</p>}
    </form>
  );
}
