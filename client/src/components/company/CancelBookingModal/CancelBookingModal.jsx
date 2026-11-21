// Modal «Cancelar la reserva de …» desde el panel de empresa (wireframe 15c), sobre ConfirmModal.
// Motivo obligatorio: se elige de la lista y, con «Otro», se escribe (1–500 caracteres, la regla de la API). Sin
// motivo no se puede cancelar. Llama a `companyService.cancelBooking` y avisa con `onCancelled(respuesta)`.
// No hay mensaje para el cliente ni reembolso: la API no los tiene todavía (docs/back-pendiente-emp.md, EMP014).
import { useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import Select from '@/components/ui/Select/Select.jsx';
import Textarea from '@/components/ui/Textarea/Textarea.jsx';
import { cancelBooking } from '@/services/companyService.js';
import { formatLongDate } from '@/utils/dates.js';
import { priceLabel } from '@/utils/formatPrice.js';
import styles from './CancelBookingModal.module.css';

const OTHER = 'otro';
const REASONS = [
  { value: 'averia', label: 'Avería en la sala' },
  { value: 'no_disponible', label: 'La sala no está disponible' },
  { value: 'evento', label: 'Evento o uso interno' },
  { value: OTHER, label: 'Otro motivo' },
];
const MAX = 500;

const pad = (hour) => String(hour).padStart(2, '0');

// Mensajes de los errores de la API al cancelar.
const ERRORS = {
  BOOKING_NOT_CANCELLABLE:
    'Esta reserva ya no se puede cancelar: solo se cancelan las confirmadas.',
  BOOKING_STARTED: 'Esta reserva ya ha empezado y no se puede cancelar.',
};

export default function CancelBookingModal({ booking, onClose, onCancelled }) {
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const motivo =
    reason === OTHER ? other.trim() : (REASONS.find((r) => r.value === reason)?.label ?? '');
  const reasonError = touched && !reason ? 'Elige un motivo.' : undefined;
  const otherError =
    touched && reason === OTHER && !other.trim()
      ? 'Escribe el motivo.'
      : other.trim().length > MAX
        ? `Como máximo ${MAX} caracteres.`
        : undefined;

  const client = booking.cliente?.nombre;
  const summary = [
    [booking.sala?.codigo, booking.sala?.nombre].filter(Boolean).join(' · '),
    formatLongDate(booking.fecha),
    `${pad(booking.inicio)}:00 – ${pad(booking.fin)}:00`,
    priceLabel(booking.importe),
  ]
    .filter(Boolean)
    .join(' · ');

  const confirm = async () => {
    setTouched(true);
    if (!motivo || motivo.length > MAX) return;
    setSaving(true);
    setError(null);
    try {
      const result = await cancelBooking(booking.id, motivo);
      onCancelled(result);
    } catch (err) {
      setError(ERRORS[err?.code] ?? err?.message ?? 'No hemos podido cancelar la reserva.');
      setSaving(false);
    }
  };

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={client ? `Cancelar la reserva de ${client}` : 'Cancelar la reserva'}
      text={summary}
      confirmLabel="Cancelar reserva"
      cancelLabel="Mantener reserva"
      onConfirm={confirm}
      loading={saving}
    >
      <div className={styles.fields}>
        <Select
          label="Motivo (obligatorio)"
          placeholder="Elige un motivo"
          value={reason}
          error={reasonError}
          required
          onChange={(event) => setReason(event.target.value)}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {reason === OTHER && (
          <Textarea
            label="Escribe el motivo"
            hint="Lo verá el cliente en «Mis reservas»."
            rows={3}
            maxLength={MAX}
            value={other}
            error={otherError}
            required
            onChange={(event) => setOther(event.target.value)}
          />
        )}
        <p className={styles.note}>
          El cliente verá la reserva como cancelada por el espacio, con este motivo.
        </p>
        {error && <Alert type="error">{error}</Alert>}
      </div>
    </ConfirmModal>
  );
}
