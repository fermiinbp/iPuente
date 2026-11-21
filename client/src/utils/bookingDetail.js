// Ayudas del detalle de reserva (BookingDetail), para que quien lo mete en un SidePanel ponga el mismo título y la
// misma etiqueta de estado que el componente: `detailTitle` y `detailStatus`.
import { BOOKING_DISPLAY_STATUS, ROLES } from '@/config/constants.js';

// ¿Es un bloqueo de horas? (en el panel de empresa los bloqueos van en la misma lista que las reservas)
export const isBlock = (booking) => booking?.tipo === 'bloqueo';

// «Reserva IP-2041», «Reserva» si no tiene código o «Bloqueo de horas».
export function detailTitle(booking) {
  if (isBlock(booking)) return 'Bloqueo de horas';
  return booking?.codigo ? `Reserva ${booking.codigo}` : 'Reserva';
}

// Estado para StatusBadge (kind="booking"). Al cliente, una cancelada le dice quién la canceló; a empresa y admin,
// «Cancelada» a secas (quién y por qué lo cuenta el detalle). Un bloqueo es «Bloqueada».
export function detailStatus(booking, role = ROLES.CLIENT) {
  if (isBlock(booking)) return BOOKING_DISPLAY_STATUS.BLOCKED;
  if (booking.estado !== 'CANCELLED' || role !== ROLES.CLIENT) return booking.estado;
  return booking.canceladaPor === 'empresa'
    ? BOOKING_DISPLAY_STATUS.CANCELLED_BY_SPACE
    : BOOKING_DISPLAY_STATUS.CANCELLED_BY_CLIENT;
}

// Texto de quién canceló y su motivo, según quién lo lee.
export function cancellationText(booking, role = ROLES.CLIENT) {
  const by = booking.canceladaPor;
  let who;
  if (role === ROLES.CLIENT) {
    who =
      by === 'empresa' ? 'El espacio ha cancelado esta reserva.' : 'Has cancelado esta reserva.';
  } else if (role === ROLES.COMPANY) {
    if (by === 'empresa') who = 'Tu empresa canceló esta reserva.';
    else if (by === 'cliente') who = 'El cliente canceló esta reserva.';
    else who = 'Esta reserva está cancelada.';
  } else if (by === 'empresa') who = 'La empresa canceló esta reserva.';
  else if (by === 'cliente') who = 'El cliente canceló esta reserva.';
  else who = 'Esta reserva está cancelada.';
  return booking.motivoCancelacion ? `${who} Motivo: ${booking.motivoCancelacion}` : who;
}
