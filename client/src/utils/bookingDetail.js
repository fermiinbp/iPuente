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
  if (booking.canceladaPor === 'admin') return booking.estado;
  return booking.canceladaPor === 'empresa'
    ? BOOKING_DISPLAY_STATUS.CANCELLED_BY_SPACE
    : BOOKING_DISPLAY_STATUS.CANCELLED_BY_CLIENT;
}

// Aviso tras cancelar, según la respuesta de la API: `reembolso` 'REFUNDED' (hecho) o 'PENDING' (con `aviso`).
// Devuelve { type, text } para un Alert.
export function cancelNotice(dateText, result) {
  const base = `Reserva del ${dateText} cancelada.`;
  if (result?.reembolso === 'REFUNDED') {
    return { type: 'success', text: `${base} Te hemos reembolsado el pago.` };
  }
  if (result?.reembolso === 'PENDING') {
    return {
      type: 'warning',
      text: `${base} El reembolso está pendiente. ${result.aviso ?? ''}`.trim(),
    };
  }
  return { type: 'success', text: base };
}

// Texto de quién canceló y su motivo, según quién lo lee.
export function cancellationText(booking, role = ROLES.CLIENT) {
  const by = booking.canceladaPor;
  let who;
  if (role === ROLES.CLIENT) {
    if (by === 'empresa') who = 'El espacio ha cancelado esta reserva.';
    else if (by === 'admin') who = 'iPuente ha cancelado esta reserva.';
    else who = 'Has cancelado esta reserva.';
  } else if (role === ROLES.COMPANY) {
    if (by === 'empresa') who = 'Tu empresa canceló esta reserva.';
    else if (by === 'cliente') who = 'El cliente canceló esta reserva.';
    else if (by === 'admin') who = 'iPuente canceló esta reserva.';
    else who = 'Esta reserva está cancelada.';
  } else if (by === 'admin') who = 'Un administrador canceló esta reserva.';
  else if (by === 'empresa') who = 'La empresa canceló esta reserva.';
  else if (by === 'cliente') who = 'El cliente canceló esta reserva.';
  else who = 'Esta reserva está cancelada.';
  return booking.motivoCancelacion ? `${who} Motivo: ${booking.motivoCancelacion}` : who;
}
