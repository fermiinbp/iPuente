// Pagos con Stripe Checkout (modo prueba). createCheckout crea (o reutiliza) la sesión de una reserva
// PENDING_PAYMENT con el importe del servidor; el webhook (firma verificada) confirma la reserva y
// guarda el pago en una sola transacción, expira la reserva si caduca la sesión y reembolsa
// automáticamente los pagos que ya no se pueden aceptar. Nunca llama a Stripe dentro de una
// transacción de Firestore ni guarda datos de tarjeta.
import { PENDING_MAX_HOLD_MINUTES } from '../config/bookingHours.js';
import { config } from '../config/config.js';
import { getStripe, getWebhookSecret, verifyWebhook } from '../config/stripe.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as companyModel from '../models/companyModel.js';
import * as occupancyModel from '../models/occupancyModel.js';
import * as paymentModel from '../models/paymentModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import {
  assertSlotAvailable,
  effectiveStatus,
  isPendingExpired,
  toDate,
  toMillis,
  toSlot,
} from './availabilityService.js';
import { extendPendingExpiry } from './bookingsService.js';
import { COMPANY_STATUS, companyStatus } from './companyService.js';
import { assertCompanyCanCharge } from './payoutsService.js';
import { reprocessRefund } from './refundService.js';
import { readReclaimPlan, releaseSlots, slotIds, writeReclaimClaims } from './occupancyService.js';

// Reembolso de pagos pendientes (vive en refundService para que lo usen también cancelar y admin).
export { reprocessRefund };

const MINUTE = 60 * 1000;
// Stripe exige que la sesión dure como mínimo 30 minutos: se piden 31 para dejar margen.
const CHECKOUT_MINUTES = 31;
const STRIPE_MIN_MS = 30 * MINUTE;
// La reserva retiene las horas hasta que vence la sesión más este margen (el webhook puede tardar).
const BOOKING_MARGIN_MS = 2 * MINUTE;
// Una sesión con menos de esto por delante ya no se reutiliza: se crea otra.
const REUSE_MIN_MS = 2 * MINUTE;
// Stripe no cobra menos de 0,50 €.
const MIN_CENTS = 50;

const unavailable = () =>
  new HttpError(503, 'PAYMENTS_UNAVAILABLE', 'Los pagos no están disponibles en este momento');

// Importe en céntimos enteros (sin errores de coma flotante). 409 INVALID_AMOUNT si es 0, negativo,
// no numérico, con fracciones de céntimo o inferior al mínimo de Stripe: nunca se crea una sesión así.
export function toCents(amount) {
  const value = Number(amount);
  const cents = Math.round(value * 100);
  if (!Number.isFinite(cents) || cents < MIN_CENTS || Math.abs(value * 100 - cents) > 1e-6) {
    throw new HttpError(409, 'INVALID_AMOUNT', 'El importe de la reserva no se puede cobrar');
  }
  return cents;
}

// Llama a Stripe y convierte cualquier fallo en 502 sin filtrar su detalle (solo se registra el tipo).
async function callStripe(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // Otra petición con la misma clave de idempotencia sigue en curso (doble clic simultáneo).
    if (err?.code === 'idempotency_key_in_use') {
      throw new HttpError(
        409,
        'PAYMENT_IN_PROGRESS',
        'Ya se está preparando tu pago; inténtalo de nuevo en unos segundos',
      );
    }
    console.error('Error de Stripe:', err?.type ?? err?.name ?? 'desconocido', err?.code ?? '');
    throw new HttpError(
      502,
      'PAYMENTS_ERROR',
      'No se ha podido conectar con el sistema de pago. Inténtalo de nuevo',
    );
  }
}

// Origen de la web (sin barra final) para las URL de vuelta; 503 si no está configurado.
function webOrigin() {
  const origin = config.appUrl?.replace(/\/+$/, '');
  if (!origin) throw unavailable();
  return origin;
}

// Comprueba que la reserva es del usuario y se puede pagar ahora: 404 si no existe o es ajena; 409 si
// venció, no está pendiente o ya empezó.
function assertPayable(booking, uid, nowMs) {
  if (!booking || booking.userId !== uid) {
    throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
  }
  if (effectiveStatus(booking, nowMs) === 'EXPIRED') {
    throw new HttpError(409, 'BOOKING_EXPIRED', 'La reserva ha caducado');
  }
  if (booking.status !== 'PENDING_PAYMENT') {
    throw new HttpError(409, 'BOOKING_NOT_PENDING', 'La reserva no está pendiente de pago');
  }
  if (toDate(booking.startDate).getTime() <= nowMs) {
    throw new HttpError(409, 'BOOKING_STARTED', 'La reserva ya ha empezado y no se puede pagar');
  }
}

// Decide en una transacción qué intento de sesión toca (y lo guarda en la reserva): reutiliza el
// vigente o abre uno nuevo (attempt + 1, con su expires_at fijo y su destino). Así dos clics a la vez
// usan los mismos parámetros y la misma clave de idempotencia. Valida propietario, estado e importe.
// `destination` es la cuenta conectada de la empresa (ya comprobada): un intento con otro destino, o
// sin destino (sesión anterior a Connect), no se reutiliza y devuelve `staleSessionId` para expirarla.
// `renewFrom` fuerza uno nuevo si el intento actual sigue siendo ese (su sesión ya no está abierta).
async function planAttempt(uid, id, { destination, renewFrom } = {}) {
  return runTransaction(async (tx) => {
    const booking = await bookingModel.findById(id, { tx });
    const nowMs = Date.now();
    assertPayable(booking, uid, nowMs);
    const amountCents = toCents(booking.totalAmount);
    const prevAttempt = booking.checkoutAttempt ?? 0;
    const prevExpires = toMillis(booking.checkoutExpiresAt);
    const left = prevExpires - nowMs;
    const forced = renewFrom !== undefined && prevAttempt === renewFrom;
    const sameDestination = booking.checkoutDestination === destination;
    // Sin sesión guardada aún, solo se reutiliza el plan si Stripe todavía acepta su expires_at.
    const reusable =
      !forced &&
      sameDestination &&
      prevAttempt > 0 &&
      left > REUSE_MIN_MS &&
      (Boolean(booking.checkoutSessionId) || left > STRIPE_MIN_MS + 5000);
    if (reusable) {
      return {
        booking,
        attempt: prevAttempt,
        expiresAt: new Date(prevExpires),
        sessionId: booking.checkoutSessionId ?? null,
        amountCents,
        destination,
      };
    }
    // Un intento nuevo solo si la sesión y su margen caben en el tope absoluto de retención.
    const created = toMillis(booking.createdAt);
    const hold = CHECKOUT_MINUTES * MINUTE + BOOKING_MARGIN_MS;
    if (!Number.isFinite(created) || nowMs + hold > created + PENDING_MAX_HOLD_MINUTES * MINUTE) {
      throw new HttpError(
        409,
        'BOOKING_EXPIRED',
        'Ya no queda tiempo para pagar esta reserva. Vuelve a reservar la sala',
      );
    }
    const attempt = prevAttempt + 1;
    const expiresAt = new Date(nowMs + CHECKOUT_MINUTES * MINUTE);
    await bookingModel.update(
      id,
      {
        checkoutAttempt: attempt,
        checkoutExpiresAt: expiresAt,
        checkoutSessionId: null,
        checkoutDestination: destination,
      },
      { tx },
    );
    // Solo se expira la sesión anterior si el destino cambió (no si simplemente se renueva).
    const staleSessionId = !forced && !sameDestination ? (booking.checkoutSessionId ?? null) : null;
    return {
      booking,
      attempt,
      expiresAt,
      sessionId: null,
      amountCents,
      destination,
      staleSessionId,
    };
  });
}

// Expira (sin esperar a que falle) una sesión de un intento con otro destino: así no se puede pagar
// cobrando sin destino. Es best effort: un fallo solo se registra (tipo, nunca el detalle).
async function expireStale(stripe, sessionId) {
  if (!sessionId) return;
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.error(
      'No se pudo expirar la sesión anterior:',
      err?.type ?? err?.name ?? 'desconocido',
    );
  }
}

// Guarda el id de la sesión creada en la reserva, solo si sigue siendo el mismo intento.
async function storeSessionId(id, attempt, sessionId) {
  await runTransaction(async (tx) => {
    const booking = await bookingModel.findById(id, { tx });
    if (booking?.checkoutAttempt === attempt) {
      await bookingModel.update(id, { checkoutSessionId: sessionId }, { tx });
    }
  });
}

// Respuesta pública de una sesión de Checkout.
function toCheckout(session) {
  return {
    url: session.url,
    sesionId: session.id,
    expiraEn: new Date(session.expires_at * 1000).toISOString(),
  };
}

// Crea (o reutiliza) la sesión de Stripe Checkout de una reserva propia pendiente de pago.
// 404 si no existe o es ajena; 409 si no está pendiente o venció; 503 sin Stripe configurado.
export async function createCheckout(uid, bookingId) {
  const stripe = getStripe();
  if (!stripe) throw unavailable();
  const origin = webOrigin();
  // Antes de cobrar: la reserva debe poder pagarse y la empresa (aprobada, con cuenta activa según
  // Stripe) poder cobrar. Esa cuenta es el destino del cobro, también al reutilizar una sesión.
  const current = await bookingModel.findById(bookingId);
  assertPayable(current, uid, Date.now());
  const destination = await assertCompanyCanCharge(current.companyId);
  let plan = await planAttempt(uid, bookingId, { destination });
  await expireStale(stripe, plan.staleSessionId);
  // Doble clic o reintento: si ya hay una sesión abierta de este intento, se devuelve la misma.
  for (let tries = 0; plan.sessionId && tries < 2; tries++) {
    const session = await callStripe(() => stripe.checkout.sessions.retrieve(plan.sessionId));
    if (session.status === 'open' && session.url) return toCheckout(session);
    if (session.status === 'complete') {
      throw new HttpError(409, 'PAYMENT_IN_PROGRESS', 'Tu pago se está procesando');
    }
    plan = await planAttempt(uid, bookingId, { destination, renewFrom: plan.attempt });
  }
  if (plan.sessionId) throw new HttpError(409, 'BUSY', 'Inténtalo de nuevo en unos segundos');
  // Primero se amplía la reserva (falla aquí si venció) y solo después se crea la sesión.
  await extendPendingExpiry(bookingId, new Date(plan.expiresAt.getTime() + BOOKING_MARGIN_MS));
  const returnUrl = `${origin}/payment/result?booking=${encodeURIComponent(bookingId)}`;
  const session = await callStripe(() =>
    stripe.checkout.sessions.create(
      {
        mode: 'payment',
        locale: 'es',
        client_reference_id: bookingId,
        metadata: { bookingId, attempt: String(plan.attempt), destination: plan.destination },
        // Destination charge: el dinero va a la cuenta conectada de la empresa (sin comisión ni on_behalf_of).
        payment_intent_data: {
          metadata: { bookingId },
          transfer_data: { destination: plan.destination },
        },
        expires_at: Math.floor(plan.expiresAt.getTime() / 1000),
        success_url: returnUrl,
        cancel_url: `${returnUrl}&cancelado=1`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: plan.amountCents,
              product_data: { name: `Reserva ${plan.booking.code ?? bookingId}` },
            },
          },
        ],
      },
      { idempotencyKey: `checkout:${bookingId}:${plan.attempt}` },
    ),
  );
  await storeSessionId(bookingId, plan.attempt, session.id);
  return toCheckout(session);
}

// Verifica la firma del webhook sobre el cuerpo sin parsear y devuelve el evento.
// 503 sin secreto configurado; 400 INVALID_SIGNATURE si falta la firma o no coincide.
export function constructEvent(rawBody, signature) {
  const invalid = () => new HttpError(400, 'INVALID_SIGNATURE', 'Firma del webhook no válida');
  if (!signature) throw invalid();
  const secret = getWebhookSecret();
  if (!secret) throw unavailable();
  if (!Buffer.isBuffer(rawBody)) throw invalid();
  try {
    return verifyWebhook(rawBody, signature, secret);
  } catch {
    throw invalid();
  }
}

// Procesa un evento ya verificado. Los desconocidos se ignoran (200). Los fallos propios (Firestore,
// reembolso) se lanzan como 500 para que Stripe reintente el evento: todo es idempotente.
export async function handleEvent(event) {
  const session = event?.data?.object;
  switch (event?.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return onPaid(event, session);
    case 'checkout.session.expired':
      return onExpired(event, session);
    default:
      return { accion: 'ignorado' };
  }
}

// id del payment_intent de una sesión (puede venir como texto o expandido).
function paymentIntentId(session) {
  const pi = session.payment_intent;
  return (typeof pi === 'string' ? pi : pi?.id) ?? null;
}

// Cuenta conectada de destino de la sesión (metadata verificada por la firma del webhook), o null.
function destinationOf(session) {
  const destination = session.metadata?.destination;
  return typeof destination === 'string' && /^acct_[A-Za-z0-9_]+$/.test(destination)
    ? destination
    : null;
}

// Motivo por el que un pago no se acepta según la empresa: no está aprobada (o no existe) o el cobro
// no fue a su cuenta de cobros actual (sesión sin destino o con otro). La reserva no se confirma.
function payoutsReason(booking, company, destination) {
  if (!booking) return null;
  if (!company || companyStatus(company) !== COMPANY_STATUS.APPROVED) return 'COMPANY_NOT_APPROVED';
  if (!destination || destination !== company.stripeAccountId) return 'NO_DESTINATION';
  return null;
}

// Fichas de occupancy de una reserva (ids y documentos leídos en la transacción).
async function readBookingSlots(booking, tx) {
  const { inicio, fin } = toSlot(booking, 'reserva');
  const ids = slotIds(booking.roomId, todayString(toDate(booking.startDate)), inicio, fin);
  const docs = await Promise.all(ids.map((id) => occupancyModel.findById(id, { tx })));
  return { ids, docs };
}

// Motivo por el que no se acepta un pago antes de mirar si la reserva está vencida (null = seguir).
function refusalReason(booking, session) {
  if (!booking) return 'BOOKING_NOT_FOUND';
  const cents = Math.round(Number(booking.totalAmount) * 100);
  if (session.amount_total !== cents || session.currency?.toLowerCase() !== 'eur') {
    return 'AMOUNT_MISMATCH';
  }
  if (booking.status === 'CANCELLED') return 'BOOKING_CANCELLED';
  if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') return 'ALREADY_PAID';
  return null;
}

// Dentro de la transacción: decide qué hacer con un pago de una reserva vencida o EXPIRED. Si todas
// sus horas siguen libres o son suyas (y no ha empezado) devuelve { claims } para confirmar; si no,
// { reason } para reembolsar. Solo lee.
async function planLatePayment(booking, tx) {
  if (toDate(booking.startDate).getTime() <= Date.now()) return { reason: 'BOOKING_STARTED' };
  try {
    const { inicio, fin } = toSlot(booking, 'reserva');
    const fecha = todayString(toDate(booking.startDate));
    await assertSlotAvailable(booking.roomId, fecha, inicio, fin, tx);
    return { claims: await readReclaimPlan(booking, { tx }) };
  } catch (err) {
    if (err instanceof HttpError && err.code === 'SLOT_TAKEN') return { reason: 'SLOT_TAKEN' };
    throw err;
  }
}

// Comprobaciones previas de un evento de sesión: modo prueba, modo `payment`, referencia coherente
// con la reserva e intento entero >= 1. Devuelve { bookingId, attempt } o { motivo } para ignorarlo.
function checkSession(event, session) {
  if (event?.livemode !== false) return { motivo: 'evento_no_es_de_prueba' };
  if (session?.livemode !== false) return { motivo: 'sesion_no_es_de_prueba' };
  if (session.mode !== 'payment') return { motivo: 'modo_distinto_de_payment' };
  const bookingId = session.metadata?.bookingId;
  if (typeof bookingId !== 'string' || !bookingId) return { motivo: 'sin_reserva' };
  if (session.client_reference_id !== bookingId) return { motivo: 'referencia_no_coincide' };
  const raw = session.metadata.attempt;
  if (typeof raw !== 'string' || !/^[1-9]\d{0,8}$/.test(raw))
    return { motivo: 'intento_no_valido' };
  return { bookingId, attempt: Number(raw) };
}

// Ignora el evento (200 sin escribir ni reembolsar) y registra solo su tipo y el motivo.
function ignore(event, motivo) {
  console.warn(`Webhook de Stripe ignorado: ${event?.type} (${motivo})`);
  return { accion: 'ignorado', motivo };
}

// Pago completado: confirma la reserva y crea el pago SUCCEEDED en una sola transacción (id del
// pago = id de la sesión, así un evento repetido no hace nada) o, si no se puede aceptar, guarda el
// pago con refundPending y lo reembolsa después (fuera de la transacción). Antes valida el evento
// (checkSession) y que el intento esté entre 1 y el último de la reserva: un intento anterior
// legítimo sigue siendo pagable. Una reserva que no existe, con el pago ya hecho, se reembolsa.
async function onPaid(event, session) {
  const checked = checkSession(event, session);
  if (checked.motivo) return ignore(event, checked.motivo);
  if (session.payment_status !== 'paid') return { accion: 'ignorado' };
  const { bookingId, attempt } = checked;
  const outcome = await runTransaction(async (tx) => {
    const existing = await paymentModel.findById(session.id, { tx });
    if (existing) return existing.refundPending ? { refund: true } : { accion: 'repetido' };
    const booking = await bookingModel.findById(bookingId, { tx });
    if (booking && attempt > (booking.checkoutAttempt ?? 0)) {
      return { ignorar: 'intento_fuera_de_rango' };
    }
    const company = booking?.companyId
      ? await companyModel.findById(booking.companyId, { tx })
      : null;
    const destination = destinationOf(session);
    let reason = refusalReason(booking, session) ?? payoutsReason(booking, company, destination);
    let claims = null;
    // Empresa que ya no puede cobrar: la reserva pendiente se expira y libera sus horas (lecturas
    // antes de escribir).
    const expire = reason === 'COMPANY_NOT_APPROVED' && booking.status === 'PENDING_PAYMENT';
    const slots = expire ? await readBookingSlots(booking, tx) : null;
    const late = !reason && (booking.status === 'EXPIRED' || isPendingExpired(booking));
    if (late) ({ reason, claims } = await planLatePayment(booking, tx));
    const amountCents = session.amount_total;
    await paymentModel.create(
      {
        bookingId,
        userId: booking?.userId ?? null,
        // Empresa de la reserva (null si no existe) y cuenta que recibió el cobro: el reembolso la usa.
        companyId: booking?.companyId ?? null,
        destinationAccountId: destination,
        amount: amountCents / 100,
        amountCents,
        currency: 'EUR',
        provider: 'STRIPE',
        providerPaymentId: paymentIntentId(session),
        providerSessionId: session.id,
        status: 'SUCCEEDED',
        ...(reason && { refundPending: true, refundReason: reason }),
      },
      { id: session.id, tx },
    );
    if (reason) {
      if (expire) {
        await bookingModel.update(bookingId, { status: 'EXPIRED' }, { tx });
        await releaseSlots(slots.ids, slots.docs, 'bookingId', bookingId, tx);
      }
      return { refund: true };
    }
    if (claims) await writeReclaimClaims(claims, { ...booking, id: bookingId }, tx);
    await bookingModel.update(
      bookingId,
      { status: 'CONFIRMED', paymentId: session.id, paidAt: now() },
      { tx },
    );
    return { accion: 'confirmada' };
  });
  if (outcome.ignorar) return ignore(event, outcome.ignorar);
  if (!outcome.refund) return outcome;
  await reprocessRefund(session.id);
  return { accion: 'reembolsado' };
}

// Sesión caducada: si la reserva sigue pendiente y la sesión es de su intento actual, pasa a
// EXPIRED y libera solo sus fichas de occupancy. Un evento que no cuadra se ignora.
async function onExpired(event, session) {
  const checked = checkSession(event, session);
  if (checked.motivo) return ignore(event, checked.motivo);
  const { bookingId, attempt } = checked;
  const outcome = await runTransaction(async (tx) => {
    const booking = await bookingModel.findById(bookingId, { tx });
    if (booking?.status !== 'PENDING_PAYMENT') return { accion: 'ignorado' };
    // Una sesión de un intento anterior no expira la reserva si ya hay otra abierta.
    if (attempt !== booking.checkoutAttempt) return { ignorar: 'intento_no_es_el_actual' };
    const { inicio, fin } = toSlot(booking, 'reserva');
    const ids = slotIds(booking.roomId, todayString(toDate(booking.startDate)), inicio, fin);
    const slots = await Promise.all(ids.map((id) => occupancyModel.findById(id, { tx })));
    await bookingModel.update(bookingId, { status: 'EXPIRED' }, { tx });
    await releaseSlots(ids, slots, 'bookingId', bookingId, tx);
    return { accion: 'expirada' };
  });
  return outcome.ignorar ? ignore(event, outcome.ignorar) : outcome;
}
