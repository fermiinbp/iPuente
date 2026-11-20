// Huecos libres de una sala en un día: una casilla por hora (8–20). Se elige una franja seguida:
// pulsa una hora y amplía con la anterior o la siguiente; las horas ocupadas no se pueden elegir.
import { BOOKING_HOURS } from '@/config/constants.js';
import styles from './AvailabilityCalendar.module.css';

const HOURS = Array.from(
  { length: BOOKING_HOURS.end - BOOKING_HOURS.start },
  (_, i) => BOOKING_HOURS.start + i,
);
const pad = (hour) => String(hour).padStart(2, '0');

// `selection` es { inicio, fin } (fin no incluido) o null. Devuelve la nueva selección al pulsar `hour`.
function nextSelection(selection, hour) {
  if (!selection) return { inicio: hour, fin: hour + 1 };
  if (hour === selection.fin) return { ...selection, fin: hour + 1 };
  if (hour === selection.inicio - 1) return { ...selection, inicio: hour };
  if (selection.fin - selection.inicio === 1 && hour === selection.inicio) return null;
  return { inicio: hour, fin: hour + 1 };
}

export default function AvailabilityCalendar({ freeHours, selection, onChange, disabled = false }) {
  const free = new Set(freeHours);
  return (
    <div role="group" aria-label="Horas del día" className={styles.grid}>
      {HOURS.map((hour) => {
        const isFree = free.has(hour);
        const selected = Boolean(selection) && hour >= selection.inicio && hour < selection.fin;
        return (
          <button
            key={hour}
            type="button"
            className={`${styles.hour} ${selected ? styles.selected : ''} ${isFree ? '' : styles.taken}`}
            disabled={!isFree || disabled}
            aria-pressed={selected}
            aria-label={`${pad(hour)}:00 a ${pad(hour + 1)}:00, ${isFree ? 'libre' : 'ocupada'}`}
            onClick={() => onChange(nextSelection(selection, hour))}
          >
            {pad(hour)}:00
          </button>
        );
      })}
    </div>
  );
}
