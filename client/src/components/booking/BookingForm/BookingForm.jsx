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
  pricePerHour,
  bookable,
  loggedIn,
  submitting,
  error,
  onSubmit,
}) {
  if (!bookable) {
    return <Alert tone="info">Esta sala no se puede reservar online.</Alert>;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selection) onSubmit();
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
        <Alert tone="error">{hoursError}</Alert>
      ) : freeHours.length === 0 ? (
        <Alert tone="info">No quedan horas libres este día. Prueba con otra fecha.</Alert>
      ) : (
        <AvailabilityCalendar
          freeHours={freeHours}
          selection={selection}
          onChange={onSelectionChange}
          disabled={submitting}
        />
      )}

      <BookingSummary fecha={fecha} selection={selection} pricePerHour={pricePerHour} />

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" loading={submitting} disabled={!selection}>
        {loggedIn ? 'Reservar' : 'Inicia sesión para reservar'}
      </Button>
    </form>
  );
}
