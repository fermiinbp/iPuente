// Formulario de reserva: fecha, horas libres, resumen y botón. No habla con la API: avisa a la página
// con onSubmit y ella crea la reserva. Tiene `id` (por defecto «reserva-form»): en móvil la página pone el
// botón en una barra fija fuera del formulario y lo asocia con `form={id}`; desde 900 px el botón va aquí.
import AvailabilityCalendar from '@/components/room/AvailabilityCalendar/AvailabilityCalendar.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import NumberStepper from '@/components/ui/NumberStepper/NumberStepper.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { attendeesError } from '@/utils/bookingForm.js';
import { todayString } from '@/utils/dates.js';
import BookingSummary from '../BookingSummary/BookingSummary.jsx';
import styles from './BookingForm.module.css';

export default function BookingForm({
  id = 'reserva-form',
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

  const attendeesProblem = attendeesError(attendees, capacity);

  function handleSubmit(event) {
    event.preventDefault();
    if (selection && !attendeesProblem && !submitting) onSubmit();
  }

  return (
    <form id={id} className={styles.form} onSubmit={handleSubmit} noValidate>
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

      <NumberStepper
        label="Asistentes"
        name="attendees"
        variant="boxed"
        min="1"
        max={capacity ?? undefined}
        step="1"
        inputMode="numeric"
        placeholder={capacity ? `Hasta ${capacity}` : undefined}
        value={attendees}
        onChange={(event) => onAttendeesChange?.(event.target.value)}
        error={attendeesProblem}
      />

      <BookingSummary fecha={fecha} selection={selection} pricePerHour={pricePerHour} />

      {error && <Alert type="error">{error}</Alert>}

      {/* En móvil el botón es el de la barra fija de la página (se asocia a este formulario con `form`). */}
      <div className={styles.inlineAction}>
        <Button
          type="submit"
          loading={submitting}
          disabled={!selection || Boolean(attendeesProblem)}
        >
          {loggedIn ? 'Reservar' : 'Inicia sesión para reservar'}
        </Button>
      </div>
      {!loggedIn && <p className={styles.loginHint}>Necesitas iniciar sesión para reservar</p>}
    </form>
  );
}
