// Cancelación de reservas, común al cliente, la empresa y el reembolso de admin. En una transacción
// pasa la reserva a CANCELLED, libera solo sus fichas de occupancy y, si tiene un pago SUCCEEDED,
// lo marca con refundPending. Después, fuera de la transacción, reembolsa en Stripe y, si la
// reserva estaba pendiente con una sesión de Checkout abierta, la expira (best effort).
import { getStripe } from '../config/stripe.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as paymentModel from '../models/paymentModel.js';
import { todayString } from '../utils/dates.js';
import { toDate, toSlot } from './availabilityService.js';
import { releaseSlots, slotIds } from './occupancyService.js';
import { reprocessRefund } from './refundService.js';

const REFUND_NOTICE =
  'La reserva se ha cancelado, pero el reembolso no se ha podido completar y queda pendiente. ' +
  'El equipo de iPuente lo gestionará.';

// Dentro de una transacción: lee las fichas de la reserva y escribe CANCELLED (con `fields`, p. ej.
// cancelledBy y cancelReason) y la liberación de las que son suyas. Las lecturas previas de
// quien la llama (pago, reserva) deben hacerse antes de llamarla.
export async function cancelInTx(booking, fields, tx) {
  const fecha = todayString(toDate(booking.startDate));
  const { inicio, fin } = toSlot(booking, 'reserva');
  const ids = slotIds(booking.roomId, fecha, inicio, fin);
  const slots = await Promise.all(ids.map((slot) => occupancyModel.findById(slot, { tx })));
  await bookingModel.update(
    booking.id,
    { status: 'CANCELLED', cancelledAt: now(), ...fields },
    { tx },
  );
  await releaseSlots(ids, slots, 'bookingId', booking.id, tx);
}

// Expira la sesión de Checkout abierta de una reserva cancelada. Best effort: un fallo no rompe la
// cancelación (si el pago llega después, el webhook lo reembolsa porque la reserva está cancelada).
async function expireSession(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return;
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.warn(
      'No se pudo expirar la sesión de Stripe:',
      err?.type ?? err?.name ?? 'desconocido',
    );
  }
}

// Cancela la reserva `id`. `verify(booking, tx)` (puede ser async) valida existencia, propiedad y estado dentro de la
// transacción (lanza el HttpError que toque). `cancelledBy` es CLIENT o COMPANY y `motivo` es
// opcional. Devuelve { id, estado: 'CANCELLED' } y, si había un pago, `reembolso` ('REFUNDED' o
// 'PENDING'); si el reembolso falla la cancelación se mantiene y se añade `aviso`.
export async function cancelBooking({ id, cancelledBy, motivo, verify }) {
  const plan = await runTransaction(async (tx) => {
    const booking = await bookingModel.findById(id, { tx });
    await verify(booking, tx);
    const payment = booking.paymentId
      ? await paymentModel.findById(booking.paymentId, { tx })
      : null;
    const paid = payment?.status === 'SUCCEEDED';
    // Un pago de otra reserva nunca se reembolsa desde aquí (solo ids y motivo en el registro).
    const mismatch = paid && payment.bookingId !== booking.id;
    if (mismatch) {
      console.error(
        `Cancelación: el pago ${payment.id} no corresponde a la reserva ${booking.id} (BOOKING_MISMATCH)`,
      );
    }
    await cancelInTx(booking, { cancelledBy, ...(motivo && { cancelReason: motivo }) }, tx);
    if (paid && !mismatch) {
      await paymentModel.update(
        payment.id,
        { refundPending: true, refundReason: payment.refundReason ?? 'BOOKING_CANCELLED' },
        { tx },
      );
    }
    return {
      paymentId: paid && !mismatch ? payment.id : null,
      sessionId: booking.status === 'PENDING_PAYMENT' ? (booking.checkoutSessionId ?? null) : null,
    };
  });
  const result = { id, estado: 'CANCELLED' };
  if (plan.paymentId) {
    try {
      await reprocessRefund(plan.paymentId);
      result.reembolso = 'REFUNDED';
    } catch {
      result.reembolso = 'PENDING';
      result.aviso = REFUND_NOTICE;
    }
  }
  await expireSession(plan.sessionId);
  return result;
}
