// Pagos en el panel de admin: listado (con su reserva y cliente, sin datos de tarjeta) y reembolso
// total. El reembolso marca el pago con refundPending y cancela la reserva en una transacción y,
// después, fuera de ella, llama a Stripe (reprocessRefund). Es idempotente: la clave de Stripe es
// estable y un pago ya reembolsado no vuelve a llamar a Stripe.
import { getStripe } from '../config/stripe.js';
import { runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as paymentModel from '../models/paymentModel.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { PAGE_SIZE } from './adminService.js';
import { effectiveStatus } from './availabilityService.js';
import { cancelInTx } from './cancellationService.js';
import { toIso } from './companyService.js';
import { reprocessRefund } from './refundService.js';

// Tope de pagos que lee el listado.
const PAYMENTS_READ_LIMIT = 500;

const notRefundable = (message) => new HttpError(409, 'PAYMENT_NOT_REFUNDABLE', message);

// Nombre completo del cliente.
const fullName = (u) => [u.name, u.surname].filter(Boolean).join(' ');

// El `id` de cada pago es el id de la sesión de Checkout de Stripe: es la clave de idempotencia
// del pago, no es secreto y solo lo ve el admin (no cambia el modelo).
// Pagos, del más reciente al más antiguo, con filtro por estado del pago (en inglés) y paginación
// de 20. Solo lee la reserva y el cliente de los pagos de la página. Nunca devuelve datos de tarjeta
// ni ids de Stripe.
export async function listPayments({ estado, page = 1, readLimit = PAYMENTS_READ_LIMIT } = {}) {
  const payments = await paymentModel.listAll({ status: estado, limit: readLimit });
  const pageItems = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const bookings = await Promise.all(pageItems.map((p) => bookingModel.findById(p.bookingId)));
  const userIds = [...new Set(bookings.map((b) => b?.userId ?? null).filter(Boolean))];
  const users = new Map(
    (await Promise.all(userIds.map((id) => userModel.findById(id)))).map((u, i) => [userIds[i], u]),
  );
  return {
    pagos: pageItems.map((p, i) => {
      const booking = bookings[i];
      const user = booking ? users.get(booking.userId) : null;
      return {
        id: p.id,
        importe: p.amount ?? null,
        moneda: p.currency ?? null,
        estado: p.status,
        reembolsoPendiente: p.refundPending === true,
        motivoReembolso: p.refundReason ?? null,
        fecha: toIso(p.createdAt) ?? null,
        reembolsadoEn: toIso(p.refundedAt) ?? null,
        reserva: booking
          ? { id: booking.id, codigo: booking.code ?? null, estado: effectiveStatus(booking) }
          : null,
        cliente: user ? { nombre: fullName(user) || null, email: user.email ?? null } : null,
      };
    }),
    total: payments.length,
    page,
    limit: PAGE_SIZE,
    truncado: payments.length >= readLimit,
  };
}

// Reembolsa por completo el pago `id`. En una transacción: comprueba que se puede reembolsar,
// cancela su reserva (solo si sigue CONFIRMED; una COMPLETED conserva su historial y su occupancy) liberando sus horas y marca el pago con refundPending.
// Después reembolsa en Stripe (reintenta si ya estaba pendiente). 404 si no existe, 409
// PAYMENT_NOT_REFUNDABLE si no está cobrado, 503 sin Stripe y 502 PAYMENTS_ERROR si Stripe falla
// (el reembolso queda pendiente y se puede reintentar). Un pago ya reembolsado responde sin llamar
// a Stripe. Devuelve { id, estado, reserva: { id, estado }, yaReembolsado? }.
export async function refundPayment(id) {
  const plan = await runTransaction(async (tx) => {
    const payment = await paymentModel.findById(id, { tx });
    if (!payment) throw new HttpError(404, 'NOT_FOUND', 'El pago no existe');
    const booking = payment.bookingId
      ? await bookingModel.findById(payment.bookingId, { tx })
      : null;
    if (payment.status === 'REFUNDED') return { done: true, booking };
    if (payment.status !== 'SUCCEEDED' || !payment.providerPaymentId) {
      throw notRefundable('Solo se puede reembolsar un pago cobrado');
    }
    if (!getStripe()) {
      throw new HttpError(
        503,
        'PAYMENTS_UNAVAILABLE',
        'Los pagos no están disponibles en este momento',
      );
    }
    const cancel = booking?.paymentId === payment.id && booking.status === 'CONFIRMED';
    if (cancel) await cancelInTx(booking, { cancelledBy: 'ADMIN' }, tx);
    if (!payment.refundPending) {
      await paymentModel.update(id, { refundPending: true, refundReason: 'ADMIN_REFUND' }, { tx });
    }
    return { done: false, booking, reservaEstado: cancel ? 'CANCELLED' : booking?.status };
  });
  const reserva = plan.booking
    ? { id: plan.booking.id, estado: plan.reservaEstado ?? plan.booking.status }
    : null;
  if (plan.done) return { id, estado: 'REFUNDED', reserva, yaReembolsado: true };
  try {
    await reprocessRefund(id);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'REFUND_FAILED') {
      throw new HttpError(
        502,
        'PAYMENTS_ERROR',
        'No se ha podido reembolsar en Stripe. El reembolso queda pendiente: inténtalo de nuevo',
      );
    }
    throw err;
  }
  return { id, estado: 'REFUNDED', reserva };
}
