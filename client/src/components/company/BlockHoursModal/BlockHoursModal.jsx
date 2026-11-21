// Modal «Bloquear horas» (wireframe 15d, sin «Repetir»): sala, fecha, desde, hasta y motivo («solo lo ves tú»).
// Al elegir sala y fecha lee las reservas y bloqueos de ese día y, si la franja choca con alguno, lo dice (con el
// cliente y su horario) y no deja bloquear. La API vuelve a comprobarlo: si alguien reservó entretanto responde
// 409 SLOT_TAKEN y se avisa igual. Se monta al abrirlo (la página lo pinta solo cuando está abierto), así cada vez
// empieza limpio. `rooms`: [{ id, label, group }] (group = edificio); `onCreated(bloqueo)` tras crearlo.
import { useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Select from '@/components/ui/Select/Select.jsx';
import { BOOKING_HOURS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { createBlock, getBlocks, getBookings } from '@/services/companyService.js';
import { findConflicts, formatSlot } from '@/utils/companyBookings.js';
import { todayString } from '@/utils/dates.js';
import styles from './BlockHoursModal.module.css';

const MOTIVO_MAX = 200;
const HOURS = Array.from(
  { length: BOOKING_HOURS.end - BOOKING_HOURS.start + 1 },
  (_, i) => BOOKING_HOURS.start + i,
);

// Salas agrupadas por edificio, en el orden en que llegan.
function groupRooms(rooms) {
  const groups = new Map();
  for (const room of rooms) {
    if (!groups.has(room.group)) groups.set(room.group, []);
    groups.get(room.group).push(room);
  }
  return [...groups];
}

const plural = (n, one, many) => (n === 1 ? one : many);

function conflictText({ bookings, blocks }) {
  const parts = [];
  if (bookings.length > 0) {
    const list = bookings
      .map((b) => `${b.cliente?.nombre || b.cliente?.email || 'un cliente'}, ${formatSlot(b)}`)
      .join('; ');
    parts.push(
      `Hay ${bookings.length} ${plural(bookings.length, 'reserva', 'reservas')} en esa franja (${list}). ${plural(bookings.length, 'Cancélala', 'Cancélalas')} antes o elige otro horario.`,
    );
  }
  if (blocks.length > 0) {
    const list = blocks.map((b) => formatSlot(b)).join('; ');
    parts.push(
      `Ya ${plural(blocks.length, 'hay un bloqueo', 'hay bloqueos')} en esa franja (${list}).`,
    );
  }
  return parts.join(' ');
}

// Mensaje en español de un error de la API al crear el bloqueo.
function errorText(error) {
  if (error?.code === 'SLOT_TAKEN') {
    return 'Esa franja ya está ocupada: alguien ha reservado o bloqueado esas horas hace un momento. Elige otro horario.';
  }
  if (error?.code === 'BUSY') {
    return 'Ahora mismo hay mucha actividad en esta sala. Inténtalo de nuevo en unos segundos.';
  }
  return error?.message || 'No hemos podido bloquear las horas. Inténtalo de nuevo.';
}

export default function BlockHoursModal({ rooms, defaultRoomId = '', onClose, onCreated }) {
  const [roomId, setRoomId] = useState(
    rooms.some((r) => r.id === defaultRoomId) ? defaultRoomId : (rooms[0]?.id ?? ''),
  );
  const [fecha, setFecha] = useState(todayString());
  const [inicio, setInicio] = useState(9);
  const [fin, setFin] = useState(14);
  const [motivo, setMotivo] = useState('');
  const [motivoTouched, setMotivoTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const today = todayString();
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= today;
  const canCheck = Boolean(roomId) && fechaValida;

  // Lo que ya hay ese día en esa sala, para avisar antes de enviar.
  const day = useFetch(
    (signal) =>
      canCheck
        ? Promise.all([
            getBookings({ desde: fecha, hasta: fecha, roomId }, { signal }),
            getBlocks({ desde: fecha, hasta: fecha, roomId }, { signal }),
          ]).then(([bookings, blocks]) => ({ bookings, blocks }))
        : Promise.resolve(null),
    `${roomId}|${fecha}|${canCheck}`,
  );
  const conflicts = day.data ? findConflicts(day.data, { inicio, fin }) : null;
  const hasConflict = Boolean(conflicts && conflicts.bookings.length + conflicts.blocks.length > 0);

  const motivoLimpio = motivo.trim();
  const motivoError =
    motivoTouched && motivoLimpio.length === 0 ? 'Escribe el motivo del bloqueo.' : undefined;
  const fechaError = fecha && !fechaValida ? 'Elige hoy o un día posterior.' : undefined;

  const changeInicio = (value) => {
    const start = Number(value);
    setInicio(start);
    if (fin <= start) setFin(start + 1);
    setError(null);
  };

  const submit = async () => {
    setMotivoTouched(true);
    if (!canCheck || motivoLimpio.length === 0 || hasConflict) return;
    setSaving(true);
    setError(null);
    try {
      const bloqueo = await createBlock({ roomId, fecha, inicio, fin, motivo: motivoLimpio });
      onCreated(bloqueo);
    } catch (err) {
      setError(errorText(err));
      if (err?.code === 'SLOT_TAKEN') day.reload();
      setSaving(false);
    }
  };

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Bloquear horas"
      text="Los clientes no podrán reservar la sala en ese horario."
      confirmLabel="Bloquear"
      cancelLabel="Cancelar"
      onConfirm={submit}
      loading={saving}
      confirmDisabled={!canCheck || hasConflict || day.loading}
    >
      <div className={styles.grid}>
        <Select
          label="Sala"
          value={roomId}
          onChange={(event) => {
            setRoomId(event.target.value);
            setError(null);
          }}
        >
          {groupRooms(rooms).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Input
          label="Fecha"
          type="date"
          min={today}
          value={fecha}
          error={fechaError}
          onChange={(event) => {
            setFecha(event.target.value);
            setError(null);
          }}
        />
        <Select label="Desde" value={inicio} onChange={(event) => changeInicio(event.target.value)}>
          {HOURS.slice(0, -1).map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </Select>
        <Select
          label="Hasta"
          value={fin}
          onChange={(event) => {
            setFin(Number(event.target.value));
            setError(null);
          }}
        >
          {HOURS.filter((h) => h > inicio).map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </Select>
        <Input
          className={styles.full}
          label="Motivo (solo lo ves tú)"
          placeholder="Mantenimiento, uso interno…"
          maxLength={MOTIVO_MAX}
          value={motivo}
          error={motivoError}
          onChange={(event) => setMotivo(event.target.value)}
          onBlur={() => setMotivoTouched(true)}
        />
      </div>

      <div className={styles.status} aria-live="polite">
        {day.loading && canCheck && <p className={styles.checking}>Comprobando esa franja…</p>}
        {hasConflict && <Alert type="warning">{conflictText(conflicts)}</Alert>}
        {day.error && (
          <p className={styles.checking}>
            No hemos podido comprobar las reservas de ese día. Si la franja está ocupada, te
            avisaremos al bloquear.
          </p>
        )}
      </div>
      {error && <Alert type="error">{error}</Alert>}
    </ConfirmModal>
  );
}
