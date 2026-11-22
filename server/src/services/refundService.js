// Reembolso de un pago con refundPending en Stripe (siempre total). Lo usan el webhook, la
// cancelación de reservas pagadas y el reembolso de admin. Nunca llama a Stripe dentro de una
// transacción de Firestore.
import { getStripe } from '../config/stripe.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as paymentModel from '../models/paymentModel.js';
import { HttpError } from '../utils/httpError.js';

// Fallos de resultado incierto de verdad: la petición pudo llegar a Stripe. Solo con ellos se
// reutiliza la clave de idempotencia (Stripe repetiría el resultado guardado con cualquier otra
// causa, incluido un 5xx). Con el resto de fallos el intento avanza; no hay riesgo de duplicar
// porque antes de crear el reembolso se listan los que ya existen y se adopta el vigente.
function keepsKey(err) {
  return err?.type === 'StripeConnectionError' || err?.code === 'idempotency_key_in_use';
}

// Estados de un reembolso de Stripe que cuentan como hecho (no se crea otro).
const LIVE_REFUND = new Set(['succeeded', 'pending']);

// Número de intento de reembolso que toca (1 si nunca falló de forma definitiva).
export const refundAttemptOf = (payment) => payment?.refundAttempt ?? 1;

// Avanza el intento guardado tras un fallo definitivo, solo si nadie lo había avanzado ya.
async function advanceAttempt(paymentId, used) {
  await runTransaction(async (tx) => {
    const payment = await paymentModel.findById(paymentId, { tx });
    if (payment && refundAttemptOf(payment) === used) {
      await paymentModel.update(paymentId, { refundAttempt: used + 1 }, { tx });
    }
  });
}

// Reembolsa un pago con refundPending. Antes lista los reembolsos del payment_intent y adopta uno
// `succeeded` o `pending` (guarda su id y marca REFUNDED) sin crear otro; si el listado falla no
// crea nada y deja refundPending. Clave de idempotencia `refund:{paymentId}:{n}`, con n persistido
// en el pago: avanza tras cualquier fallo salvo errores de conexión o clave en uso. `charge_already_refunded` cuenta como éxito. Con cualquier otro
// fallo el pago conserva refundPending y se lanza 500 REFUND_FAILED. Sin refundPending no hace
// nada. 503 sin Stripe. Devuelve { id, estado }.
export async function reprocessRefund(paymentId) {
  const payment = await paymentModel.findById(paymentId);
  if (!payment?.refundPending) return { id: paymentId, estado: payment?.status ?? null };
  const stripe = getStripe();
  if (!stripe) {
    throw new HttpError(
      503,
      'PAYMENTS_UNAVAILABLE',
      'Los pagos no están disponibles en este momento',
    );
  }
  if (!payment.providerPaymentId) {
    throw new HttpError(500, 'REFUND_FAILED', 'No se ha podido reembolsar el pago');
  }
  const attempt = refundAttemptOf(payment);
  let refundId;
  try {
    const existing = await stripe.refunds.list({
      payment_intent: payment.providerPaymentId,
      limit: 100,
    });
    refundId = existing?.data?.find((r) => LIVE_REFUND.has(r.status))?.id ?? null;
  } catch (err) {
    console.error('Listado de reembolsos fallido:', err?.type ?? err?.name ?? 'desconocido');
    throw new HttpError(500, 'REFUND_FAILED', 'No se ha podido reembolsar el pago');
  }
  if (!refundId) {
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.providerPaymentId,
          metadata: { bookingId: payment.bookingId, motivo: payment.refundReason ?? '' },
        },
        { idempotencyKey: `refund:${paymentId}:${attempt}` },
      );
      refundId = refund?.id ?? null;
    } catch (err) {
      if (err?.code !== 'charge_already_refunded') {
        console.error(
          'Reembolso fallido:',
          err?.type ?? err?.name ?? 'desconocido',
          err?.code ?? '',
        );
        if (!keepsKey(err)) await advanceAttempt(paymentId, attempt);
        throw new HttpError(500, 'REFUND_FAILED', 'No se ha podido reembolsar el pago');
      }
    }
  }
  await paymentModel.update(paymentId, {
    status: 'REFUNDED',
    refundPending: false,
    ...(refundId && { refundId }),
    refundedAt: now(),
  });
  return { id: paymentId, estado: 'REFUNDED' };
}
