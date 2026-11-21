// Test de integración: POST /api/payments/checkout/:bookingId y el webhook POST /api/payments/webhook
// con Stripe sustituido por un doble (nunca hay llamadas reales). El webhook se prueba con cuerpo crudo
// real y firma generada con el mismo algoritmo de Stripe.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import Stripe from 'stripe';

import { setDbForTests } from '../../src/config/config.js';
import { swaggerSpec } from '../../src/config/swagger.js';
import { getStripe, setStripeForTests } from '../../src/config/stripe.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import { setRateLimitForTests } from '../../src/middlewares/rateLimit.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as paymentModel from '../../src/models/paymentModel.js';
import * as bookingsService from '../../src/services/bookingsService.js';
import { reprocessRefund, toCents } from '../../src/services/paymentsService.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { createStripeDouble } from '../helpers/stripeDouble.js';
import { listen, seedPublicData } from '../helpers/publicData.js';

const FUT = '2030-03-12';
const SECRET = 'whsec_test_secret_para_tests';
const MINUTE = 60 * 1000;
const minutes = (n) => new Date(Date.now() + n * MINUTE);
const at = (fecha, hour) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

describe('Pagos con Stripe (checkout y webhook)', () => {
  let server;
  let baseUrl;
  let stripe;
  let logged;
  let warned;
  // Intento de pago que llevan por defecto las reservas sembradas (los tests de webhook lo ponen a 1).
  let defaultAttempt = 0;
  const savedKey = process.env.STRIPE_SECRET_KEY;

  const tokenRole = { empresa: 'COMPANY', admin: 'ADMIN' };
  const verifier = async (token) => ({ uid: token, role: tokenRole[token] });

  async function checkout(bookingId, { token = 'u1' } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseUrl}/api/payments/checkout/${bookingId}`, {
      method: 'POST',
      headers,
    });
    return { status: res.status, body: await res.json() };
  }

  // Envía un evento al webhook con el cuerpo crudo y la firma de Stripe (o la que se indique).
  async function webhook(event, { secret = SECRET, signature, payload } = {}) {
    const body = payload ?? JSON.stringify(event);
    const headers = { 'Content-Type': 'application/json' };
    if (signature !== null) {
      headers['Stripe-Signature'] =
        signature ?? Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    }
    const res = await fetch(`${baseUrl}/api/payments/webhook`, { method: 'POST', headers, body });
    return { status: res.status, body: await res.json() };
  }

  const eventOf = (type, session) => ({
    id: 'evt_1',
    object: 'event',
    type,
    livemode: false,
    data: { object: session },
  });
  const paidSession = (bookingId, extra = {}) => ({
    id: 'cs_test_paid',
    object: 'checkout.session',
    payment_status: 'paid',
    amount_total: 5000,
    currency: 'eur',
    payment_intent: 'pi_test_1',
    livemode: false,
    mode: 'payment',
    client_reference_id: bookingId,
    metadata: { bookingId, attempt: '1' },
    ...extra,
  });
  const completed = (bookingId, extra) =>
    eventOf('checkout.session.completed', paidSession(bookingId, extra));

  // Reserva de r-free (25 €/h) con sus fichas de occupancy. Por defecto, pendiente y vigente.
  async function seedBooking(
    id,
    { status = 'PENDING_PAYMENT', expiresAt = minutes(10), ...extra } = {},
  ) {
    const { inicio = 10, fin = 12, fecha = FUT, claims = true, userId = 'u1' } = extra;
    const createdAt = 'createdAt' in extra ? extra.createdAt : new Date();
    await bookingModel.create(
      {
        code: `IP-${id}`,
        userId,
        companyId: 'c1',
        roomId: 'r-free',
        startDate: at(fecha, inicio),
        endDate: at(fecha, fin),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: extra.totalAmount ?? 25 * (fin - inicio),
        status,
        paymentId: null,
        ...(expiresAt && { expiresAt }),
      },
      { id },
    );
    const attempt = extra.attempt ?? defaultAttempt;
    // createdAt lo pone el servidor (marca de tiempo); aquí se fija un valor real, salvo createdAt: null.
    await bookingModel.update(id, {
      ...(createdAt && { createdAt }),
      ...(attempt && { checkoutAttempt: attempt }),
    });
    if (!claims) return;
    for (let h = inicio; h < fin; h++) {
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: fecha, hour: h, bookingId: id },
        { id: occupancyModel.slotId('r-free', fecha, h) },
      );
    }
  }

  const slot = (h, fecha = FUT) =>
    occupancyModel.findById(occupancyModel.slotId('r-free', fecha, h));

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    setTokenVerifier(verifier);
    setDbForTests(createFakeFirestore());
    await seedPublicData();
    stripe = createStripeDouble();
    setStripeForTests({ client: stripe, webhookSecret: SECRET });
    logged = [];
    warned = [];
    defaultAttempt = 0;
    mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
    mock.method(console, 'warn', (...args) => warned.push(args.join(' ')));
  });

  afterEach(() => {
    mock.restoreAll();
    setRateLimitForTests(null);
  });

  after(async () => {
    if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedKey;
    setStripeForTests(null);
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('toCents', () => {
    it('convierte a céntimos enteros sin errores de coma flotante', () => {
      assert.equal(toCents(50), 5000);
      assert.equal(toCents(59.97), 5997);
      assert.equal(toCents(19.99 * 3), 5997);
      assert.equal(toCents(0.1 + 0.2 + 0.2), 50);
      assert.equal(toCents(12.5), 1250);
    });

    it('rechaza 0, negativos, no numéricos, fracciones de céntimo y menos de 0,50 €', () => {
      for (const bad of [0, -5, NaN, 'abc', null, undefined, 10.005, 0.3]) {
        assert.throws(
          () => toCents(bad),
          (err) => err.status === 409 && err.code === 'INVALID_AMOUNT',
          String(bad),
        );
      }
    });
  });

  describe('documentación', () => {
    it('el checkout (con bearerAuth) y el webhook (sin security) están en la especificación', () => {
      const checkoutOp = swaggerSpec.paths['/payments/checkout/{bookingId}']?.post;
      assert.ok(checkoutOp, 'falta el checkout');
      assert.deepEqual(checkoutOp.tags, ['Pagos']);
      assert.deepEqual(checkoutOp.security, [{ bearerAuth: [] }]);
      const hook = swaggerSpec.paths['/payments/webhook']?.post;
      assert.ok(hook, 'falta el webhook');
      assert.equal(hook.security, undefined);
    });
  });

  describe('configuración de Stripe', () => {
    it('una clave sk_live_ se rechaza y una sk_test_ se acepta', () => {
      setStripeForTests(null);
      process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
      assert.equal(getStripe(), null);
      process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
      assert.ok(getStripe());
      delete process.env.STRIPE_SECRET_KEY;
      assert.equal(getStripe(), null);
    });
  });

  describe('POST /api/payments/checkout/:bookingId', () => {
    it('401 sin token y 403 para empresa y admin', async () => {
      await seedBooking('bk-a');
      assert.equal((await checkout('bk-a', { token: null })).status, 401);
      assert.equal((await checkout('bk-a', { token: 'empresa' })).status, 403);
      assert.equal((await checkout('bk-a', { token: 'admin' })).status, 403);
      assert.equal(stripe.calls.create.length, 0);
    });

    it('400 si el id no es válido', async () => {
      assert.equal((await checkout('bad.id')).status, 400);
    });

    it('404 igual para una reserva ajena y una inexistente', async () => {
      await seedBooking('bk-a', { userId: 'u2' });
      const ajena = await checkout('bk-a');
      const nada = await checkout('no-existe');
      assert.equal(ajena.status, 404);
      assert.deepEqual(ajena.body, nada.body);
      assert.equal(stripe.calls.create.length, 0);
    });

    it('503 PAYMENTS_UNAVAILABLE sin claves o con una clave sk_live_', async () => {
      await seedBooking('bk-a');
      setStripeForTests(null);
      const sinClave = await checkout('bk-a');
      assert.equal(sinClave.status, 503);
      assert.equal(sinClave.body.error.code, 'PAYMENTS_UNAVAILABLE');
      process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
      const live = await checkout('bk-a');
      assert.equal(live.status, 503);
      assert.equal(live.body.error.code, 'PAYMENTS_UNAVAILABLE');
    });

    it('crea la sesión con el importe del servidor en céntimos, EUR y las URL de la web', async () => {
      await seedBooking('bk-a');
      const antes = Date.now();
      const { status, body } = await checkout('bk-a');
      assert.equal(status, 200);
      assert.equal(body.sesionId, 'cs_test_1');
      assert.equal(body.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
      const { params, options } = stripe.calls.create[0];
      assert.equal(params.mode, 'payment');
      assert.equal(params.line_items.length, 1);
      assert.equal(params.line_items[0].price_data.unit_amount, 5000);
      assert.equal(params.line_items[0].price_data.currency, 'eur');
      assert.equal(params.client_reference_id, 'bk-a');
      assert.equal(params.metadata.bookingId, 'bk-a');
      assert.equal(params.success_url, 'http://localhost:5173/payment/result?booking=bk-a');
      assert.equal(params.cancel_url, `${params.success_url}&cancelado=1`);
      assert.equal(options.idempotencyKey, 'checkout:bk-a:1');
      const ms = params.expires_at * 1000 - antes;
      assert.ok(ms >= 30 * MINUTE && ms <= 31 * MINUTE + 5000, `expires_at a ${ms} ms`);
      assert.equal(body.expiraEn, new Date(params.expires_at * 1000).toISOString());
      assert.ok(!JSON.stringify(params).includes('u1'), 'no lleva datos del usuario');
    });

    it('el importe sale de la reserva, no de lo que mande el cliente, y sin errores de coma flotante', async () => {
      await seedBooking('bk-a', { totalAmount: 19.99 * 3 });
      await checkout('bk-a');
      assert.equal(stripe.calls.create[0].params.line_items[0].price_data.unit_amount, 5997);
    });

    it('amplía expiresAt de la reserva hasta el fin de la sesión más un margen', async () => {
      await seedBooking('bk-a', { expiresAt: minutes(3) });
      const { body } = await checkout('bk-a');
      const booking = await bookingModel.findById('bk-a');
      const sesion = Date.parse(body.expiraEn);
      assert.ok(booking.expiresAt.getTime() >= sesion + MINUTE);
      assert.ok(booking.expiresAt.getTime() <= sesion + 3 * MINUTE);
      assert.equal(booking.checkoutSessionId, 'cs_test_1');
      assert.equal(booking.status, 'PENDING_PAYMENT');
      assert.equal((await slot(10)).bookingId, 'bk-a');
    });

    it('un doble clic devuelve la misma sesión abierta sin crear otra', async () => {
      await seedBooking('bk-a');
      const primera = await checkout('bk-a');
      const segunda = await checkout('bk-a');
      assert.equal(segunda.status, 200);
      assert.deepEqual(segunda.body, primera.body);
      assert.equal(stripe.calls.create.length, 1);
      assert.deepEqual(stripe.calls.retrieve, ['cs_test_1']);
    });

    it('dos peticiones a la vez usan los mismos parámetros y la misma clave de idempotencia', async () => {
      await seedBooking('bk-a');
      const [a, b] = await Promise.all([checkout('bk-a'), checkout('bk-a')]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal(a.body.sesionId, b.body.sesionId);
      const keys = new Set(stripe.calls.create.map((c) => c.options.idempotencyKey));
      const expires = new Set(stripe.calls.create.map((c) => c.params.expires_at));
      assert.equal(keys.size, 1);
      assert.equal(expires.size, 1);
      assert.equal(stripe.sessions.size, 1);
    });

    it('si la sesión guardada ya no está abierta, abre otro intento con otra clave', async () => {
      await seedBooking('bk-a');
      await checkout('bk-a');
      stripe.sessions.get('cs_test_1').status = 'expired';
      const { status, body } = await checkout('bk-a');
      assert.equal(status, 200);
      assert.equal(body.sesionId, 'cs_test_2');
      assert.equal(stripe.calls.create[1].options.idempotencyKey, 'checkout:bk-a:2');
      assert.equal((await bookingModel.findById('bk-a')).checkoutSessionId, 'cs_test_2');
    });

    it('409 PAYMENT_IN_PROGRESS si la sesión guardada ya está completada', async () => {
      await seedBooking('bk-a');
      await checkout('bk-a');
      stripe.sessions.get('cs_test_1').status = 'complete';
      const res = await checkout('bk-a');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYMENT_IN_PROGRESS');
      assert.equal(stripe.calls.create.length, 1);
    });

    it('409 si la reserva no está pendiente y no se crea sesión', async () => {
      for (const status of ['CONFIRMED', 'CANCELLED', 'EXPIRED']) {
        await seedBooking(`bk-${status}`, { status, expiresAt: null, claims: false });
        const res = await checkout(`bk-${status}`);
        assert.equal(res.status, 409, status);
        assert.ok(['BOOKING_NOT_PENDING', 'BOOKING_EXPIRED'].includes(res.body.error.code));
      }
      assert.equal(stripe.calls.create.length, 0);
    });

    it('409 BOOKING_EXPIRED si la pendiente ya venció, sin crear sesión ni ampliarla', async () => {
      await seedBooking('bk-a', { expiresAt: minutes(-1) });
      const res = await checkout('bk-a');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'BOOKING_EXPIRED');
      assert.equal(stripe.calls.create.length, 0);
      const booking = await bookingModel.findById('bk-a');
      assert.ok(booking.expiresAt.getTime() < Date.now());
      assert.equal(booking.checkoutAttempt, undefined);
    });

    it('nunca crea una sesión de 0 € (409 INVALID_AMOUNT)', async () => {
      await seedBooking('bk-a', { totalAmount: 0 });
      const res = await checkout('bk-a');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_AMOUNT');
      assert.equal(stripe.calls.create.length, 0);
    });

    it('si Stripe falla responde 502 sin filtrar su detalle', async () => {
      await seedBooking('bk-a');
      stripe.failCreate = true;
      const res = await checkout('bk-a');
      assert.equal(res.status, 502);
      assert.equal(res.body.error.code, 'PAYMENTS_ERROR');
      assert.ok(!JSON.stringify(res.body).includes('detalle-secreto'));
      assert.ok(!logged.join('\n').includes('detalle-secreto'));
    });

    it('el pago no se activa solo: una reserva CONFIRMED creada hoy no tiene sesión', async () => {
      const res = await bookingsService.createBooking('u1', {
        roomId: 'r-free',
        fecha: FUT,
        inicio: 14,
        fin: 15,
      });
      assert.equal(res.estado, 'CONFIRMED');
      assert.equal((await checkout(res.id)).status, 409);
    });
  });

  describe('POST /api/payments/webhook: firma', () => {
    it('503 sin secreto configurado', async () => {
      setStripeForTests({ client: stripe, webhookSecret: undefined });
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'PAYMENTS_UNAVAILABLE');
    });

    it('400 con firma inválida, sin firma o con el cuerpo alterado', async () => {
      await seedBooking('bk-a');
      const event = completed('bk-a');
      const malo = await webhook(event, { secret: 'whsec_otro' });
      assert.equal(malo.status, 400);
      assert.equal(malo.body.error.code, 'INVALID_SIGNATURE');
      assert.equal((await webhook(event, { signature: null })).status, 400);
      const payload = JSON.stringify(event);
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
      const alterado = await webhook(event, { signature: header, payload: `${payload} ` });
      assert.equal(alterado.status, 400);
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
    });

    it('no pasa por el límite general de peticiones', async () => {
      setRateLimitForTests({ general: { limit: 1, windowMs: 60000 } });
      for (let i = 0; i < 3; i++) {
        const res = await webhook(eventOf('customer.created', { id: 'cus_1' }));
        assert.equal(res.status, 200);
      }
    });

    it('un evento desconocido responde 200 sin hacer nada', async () => {
      await seedBooking('bk-a');
      const res = await webhook(eventOf('payment_intent.created', { id: 'pi_1' }));
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { recibido: true });
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
    });
  });

  describe('checkout.session.completed', () => {
    beforeEach(() => {
      defaultAttempt = 1;
    });

    it('confirma la reserva y guarda el pago SUCCEEDED en una sola operación', async () => {
      await seedBooking('bk-a');
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 200);
      const booking = await bookingModel.findById('bk-a');
      assert.equal(booking.status, 'CONFIRMED');
      assert.equal(booking.paymentId, 'cs_test_paid');
      const pago = await paymentModel.findById('cs_test_paid');
      assert.equal(pago.status, 'SUCCEEDED');
      assert.equal(pago.bookingId, 'bk-a');
      assert.equal(pago.userId, 'u1');
      assert.equal(pago.amount, 50);
      assert.equal(pago.amountCents, 5000);
      assert.equal(pago.currency, 'EUR');
      assert.equal(pago.provider, 'STRIPE');
      assert.equal(pago.providerPaymentId, 'pi_test_1');
      assert.equal(pago.refundPending, undefined);
      assert.equal((await slot(10)).bookingId, 'bk-a');
      assert.equal(stripe.calls.refunds.length, 0);
    });

    it('un evento duplicado responde 200 sin repetir nada', async () => {
      await seedBooking('bk-a');
      await webhook(completed('bk-a'));
      const antes = await bookingModel.findById('bk-a');
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await paymentModel.listByBooking('bk-a')).length, 1);
      assert.equal(stripe.calls.refunds.length, 0);
      assert.equal(
        (await bookingModel.findById('bk-a')).paidAt?.toString(),
        antes.paidAt?.toString(),
      );
    });

    it('un evento duplicado a la vez crea un solo pago', async () => {
      await seedBooking('bk-a');
      const [a, b] = await Promise.all([webhook(completed('bk-a')), webhook(completed('bk-a'))]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal((await paymentModel.listByBooking('bk-a')).length, 1);
      assert.equal(stripe.calls.refunds.length, 0);
    });

    it('payment_status distinto de paid se ignora', async () => {
      await seedBooking('bk-a');
      const res = await webhook(completed('bk-a', { payment_status: 'unpaid' }));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
      assert.equal((await paymentModel.listByBooking('bk-a')).length, 0);
    });

    it('un importe que no coincide no confirma: se registra el pago y se reembolsa', async () => {
      await seedBooking('bk-a');
      const res = await webhook(completed('bk-a', { amount_total: 100 }));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
      const pago = await paymentModel.findById('cs_test_paid');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundReason, 'AMOUNT_MISMATCH');
      assert.equal(pago.refundPending, false);
      assert.equal(stripe.calls.refunds.length, 1);
      assert.equal(stripe.calls.refunds[0].options.idempotencyKey, 'refund:cs_test_paid:1');
      assert.equal(stripe.calls.refunds[0].params.payment_intent, 'pi_test_1');
    });

    it('una moneda distinta de EUR tampoco confirma', async () => {
      await seedBooking('bk-a');
      await webhook(completed('bk-a', { currency: 'usd' }));
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
      assert.equal((await paymentModel.findById('cs_test_paid')).refundReason, 'AMOUNT_MISMATCH');
    });

    it('una reserva cancelada que llega pagada se reembolsa y sigue cancelada', async () => {
      await seedBooking('bk-a', { status: 'CANCELLED', expiresAt: null, claims: false });
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CANCELLED');
      const pago = await paymentModel.findById('cs_test_paid');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundReason, 'BOOKING_CANCELLED');
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('un segundo pago (otra sesión) de una reserva ya confirmada se reembolsa', async () => {
      await seedBooking('bk-a');
      await webhook(completed('bk-a'));
      const res = await webhook(completed('bk-a', { id: 'cs_test_dos', payment_intent: 'pi_dos' }));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).paymentId, 'cs_test_paid');
      assert.equal((await paymentModel.findById('cs_test_dos')).refundReason, 'ALREADY_PAID');
      assert.equal(stripe.calls.refunds.length, 1);
      assert.equal(stripe.calls.refunds[0].params.payment_intent, 'pi_dos');
    });

    it('una reserva que no existe se registra y se reembolsa', async () => {
      const res = await webhook(completed('fantasma'));
      assert.equal(res.status, 200);
      assert.equal((await paymentModel.findById('cs_test_paid')).refundReason, 'BOOKING_NOT_FOUND');
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('si el reembolso falla responde 500, deja refundPending y el reintento lo completa', async () => {
      await seedBooking('bk-a', { status: 'CANCELLED', expiresAt: null, claims: false });
      stripe.failRefund = true;
      const fallo = await webhook(completed('bk-a'));
      assert.equal(fallo.status, 500);
      assert.ok(!JSON.stringify(fallo.body).includes('detalle-secreto'));
      assert.ok(!logged.join('\n').includes('pi_test_1'), 'no se registra el cuerpo del evento');
      const pendiente = await paymentModel.findById('cs_test_paid');
      assert.equal(pendiente.refundPending, true);
      assert.equal(pendiente.status, 'SUCCEEDED');
      // Stripe reenvía el evento: el pago ya existe y solo se repite el reembolso.
      stripe.failRefund = false;
      const reintento = await webhook(completed('bk-a'));
      assert.equal(reintento.status, 200);
      const hecho = await paymentModel.findById('cs_test_paid');
      assert.equal(hecho.status, 'REFUNDED');
      assert.equal(hecho.refundPending, false);
      assert.equal((await paymentModel.listByBooking('bk-a')).length, 1);
      const keys = stripe.calls.refunds.map((c) => c.options.idempotencyKey);
      assert.deepEqual(keys, ['refund:cs_test_paid:1', 'refund:cs_test_paid:2']);
    });
  });

  describe('clave de idempotencia del reembolso', () => {
    const seedPending = () =>
      paymentModel.create(
        {
          bookingId: 'bk-a',
          amount: 50,
          currency: 'EUR',
          provider: 'STRIPE',
          providerPaymentId: 'pi_x',
          status: 'SUCCEEDED',
          refundPending: true,
          refundReason: 'SLOT_TAKEN',
        },
        { id: 'cs_x' },
      );
    const keys = () => stripe.calls.refunds.map((c) => c.options.idempotencyKey);

    it('tras un fallo definitivo de Stripe el siguiente intento usa una clave nueva', async () => {
      await seedPending();
      stripe.failRefund = true;
      stripe.refundError = { type: 'StripeInvalidRequestError', code: 'parameter_invalid' };
      await assert.rejects(reprocessRefund('cs_x'), (e) => e.code === 'REFUND_FAILED');
      assert.equal((await paymentModel.findById('cs_x')).refundAttempt, 2);
      stripe.failRefund = false;
      assert.deepEqual(await reprocessRefund('cs_x'), { id: 'cs_x', estado: 'REFUNDED' });
      assert.deepEqual(keys(), ['refund:cs_x:1', 'refund:cs_x:2']);
    });

    it('con un error de conexión o clave en uso reutiliza la misma clave', async () => {
      await seedPending();
      stripe.failRefund = true;
      for (const err of [
        { type: 'StripeConnectionError' },
        { type: 'StripeIdempotencyError', code: 'idempotency_key_in_use' },
      ]) {
        stripe.refundError = err;
        await assert.rejects(reprocessRefund('cs_x'), (e) => e.code === 'REFUND_FAILED');
      }
      assert.equal((await paymentModel.findById('cs_x')).refundAttempt, undefined);
      stripe.failRefund = false;
      await reprocessRefund('cs_x');
      assert.deepEqual(new Set(keys()), new Set(['refund:cs_x:1']));
      assert.equal(stripe.calls.refunds.length, 3);
    });

    it('un 5xx (StripeAPIError) o StripeIdempotencyError avanza el intento y el reintento completa', async () => {
      for (const err of [
        { type: 'StripeAPIError', statusCode: 500 },
        { type: 'StripeIdempotencyError' },
      ]) {
        await paymentModel.remove('cs_x');
        stripe.calls.refunds.length = 0;
        stripe.existingRefunds.length = 0;
        await seedPending();
        stripe.failRefund = true;
        stripe.refundError = err;
        await assert.rejects(reprocessRefund('cs_x'), (e) => e.code === 'REFUND_FAILED');
        assert.equal((await paymentModel.findById('cs_x')).refundAttempt, 2);
        stripe.failRefund = false;
        await reprocessRefund('cs_x');
        assert.deepEqual(keys(), ['refund:cs_x:1', 'refund:cs_x:2']);
        assert.equal((await paymentModel.findById('cs_x')).status, 'REFUNDED');
      }
    });

    it('adopta un reembolso ya existente (succeeded o pending) sin crear otro', async () => {
      for (const status of ['succeeded', 'pending']) {
        await paymentModel.remove('cs_x');
        stripe.calls.refunds.length = 0;
        stripe.existingRefunds.length = 0;
        await seedPending();
        stripe.existingRefunds.push({ id: `re_old_${status}`, payment_intent: 'pi_x', status });
        assert.deepEqual(await reprocessRefund('cs_x'), { id: 'cs_x', estado: 'REFUNDED' });
        assert.equal(stripe.calls.refunds.length, 0, 'no crea otro');
        const pago = await paymentModel.findById('cs_x');
        assert.equal(pago.refundId, `re_old_${status}`);
        assert.equal(pago.refundPending, false);
      }
    });

    it('un reembolso existente fallido o cancelado no se adopta: se crea uno', async () => {
      await seedPending();
      stripe.existingRefunds.push({ id: 're_f', payment_intent: 'pi_x', status: 'failed' });
      await reprocessRefund('cs_x');
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('un 5xx que sí creó el reembolso se adopta en el reintento sin duplicar', async () => {
      await seedPending();
      stripe.failRefund = true;
      stripe.createdDespiteError = true;
      stripe.refundError = { type: 'StripeAPIError', statusCode: 500 };
      await assert.rejects(reprocessRefund('cs_x'), (e) => e.code === 'REFUND_FAILED');
      stripe.failRefund = false;
      await reprocessRefund('cs_x');
      assert.equal(stripe.calls.refunds.length, 1, 'el reintento no crea otro');
      assert.equal((await paymentModel.findById('cs_x')).refundId, 're_real_1');
    });

    it('si refunds.list falla no crea el reembolso y deja refundPending', async () => {
      await seedPending();
      stripe.failList = true;
      await assert.rejects(reprocessRefund('cs_x'), (e) => e.code === 'REFUND_FAILED');
      assert.equal(stripe.calls.refunds.length, 0);
      const pago = await paymentModel.findById('cs_x');
      assert.equal(pago.refundPending, true);
      assert.equal(pago.status, 'SUCCEEDED');
      stripe.failList = false;
      await reprocessRefund('cs_x');
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('charge_already_refunded cuenta como reembolsado sin avanzar el intento', async () => {
      await seedPending();
      stripe.failRefund = true;
      stripe.refundError = { type: 'StripeInvalidRequestError', code: 'charge_already_refunded' };
      assert.deepEqual(await reprocessRefund('cs_x'), { id: 'cs_x', estado: 'REFUNDED' });
      const pago = await paymentModel.findById('cs_x');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundAttempt, undefined);
    });
  });

  describe('pago tardío', () => {
    beforeEach(() => {
      defaultAttempt = 1;
    });

    it('reserva EXPIRED con sus horas libres: se confirma y recrea las fichas', async () => {
      await seedBooking('bk-a', { status: 'EXPIRED', expiresAt: minutes(-20), claims: false });
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await paymentModel.findById('cs_test_paid')).status, 'SUCCEEDED');
      assert.equal((await slot(10)).bookingId, 'bk-a');
      assert.equal((await slot(11)).bookingId, 'bk-a');
      assert.equal(stripe.calls.refunds.length, 0);
    });

    it('pendiente vencida por reloj con sus fichas aún suyas: se confirma', async () => {
      await seedBooking('bk-a', { expiresAt: minutes(-5) });
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await slot(11)).bookingId, 'bk-a');
    });

    it('con una hora ocupada por otra reserva: reembolso automático y no se confirma', async () => {
      await seedBooking('bk-a', { expiresAt: minutes(-5) });
      // Otra clienta reserva encima de la pendiente vencida (la expira y ocupa sus horas).
      const otra = await bookingsService.createBooking('u2', {
        roomId: 'r-free',
        fecha: FUT,
        inicio: 11,
        fin: 13,
      });
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
      const pago = await paymentModel.findById('cs_test_paid');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundReason, 'SLOT_TAKEN');
      assert.equal(stripe.calls.refunds.length, 1);
      assert.equal((await slot(11)).bookingId, otra.id);
      assert.equal((await slot(12)).bookingId, otra.id);
      assert.equal((await bookingModel.findById(otra.id)).status, 'CONFIRMED');
    });

    it('con la franja bloqueada por la empresa: reembolso', async () => {
      await seedBooking('bk-a', { status: 'EXPIRED', expiresAt: minutes(-20), claims: false });
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour: 11, blockId: 'bl-x' },
        { id: occupancyModel.slotId('r-free', FUT, 11) },
      );
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
      assert.equal((await paymentModel.findById('cs_test_paid')).refundReason, 'SLOT_TAKEN');
      assert.equal((await slot(11)).blockId, 'bl-x');
      assert.equal(await slot(10), null);
    });

    it('con la franja ya empezada: reembolso', async () => {
      await seedBooking('bk-a', {
        status: 'EXPIRED',
        expiresAt: null,
        claims: false,
        fecha: '2020-01-01',
      });
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
      assert.equal((await paymentModel.findById('cs_test_paid')).refundReason, 'BOOKING_STARTED');
    });
  });

  describe('checkout.session.expired', () => {
    const expired = (bookingId, attempt = '1') =>
      eventOf('checkout.session.expired', {
        id: 'cs_test_exp',
        livemode: false,
        mode: 'payment',
        client_reference_id: bookingId,
        metadata: { bookingId, attempt },
      });

    it('expira la reserva pendiente y libera solo sus fichas', async () => {
      await seedBooking('bk-a');
      await checkout('bk-a');
      // Una ficha de otra reserva en otra hora no se toca.
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour: 15, bookingId: 'otra' },
        { id: occupancyModel.slotId('r-free', FUT, 15) },
      );
      const res = await webhook(expired('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
      assert.equal(await slot(10), null);
      assert.equal(await slot(11), null);
      assert.equal((await slot(15)).bookingId, 'otra');
    });

    it('si la reserva ya está confirmada no hace nada (evento desordenado)', async () => {
      await seedBooking('bk-a', { attempt: 1 });
      await webhook(completed('bk-a'));
      const res = await webhook(expired('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await slot(10)).bookingId, 'bk-a');
    });

    it('la expiración de un intento anterior no expira la reserva con otro intento abierto', async () => {
      await seedBooking('bk-a');
      await checkout('bk-a');
      stripe.sessions.get('cs_test_1').status = 'expired';
      await checkout('bk-a');
      await webhook(expired('bk-a', '1'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
      await webhook(expired('bk-a', '2'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
    });

    it('un evento duplicado no cambia nada más', async () => {
      await seedBooking('bk-a');
      await checkout('bk-a');
      await webhook(expired('bk-a'));
      const res = await webhook(expired('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
    });
  });
  // Simula que pasan `mins` minutos adelantando hacia el pasado todas las marcas de la reserva.
  async function age(id, mins) {
    const b = await bookingModel.findById(id);
    const back = (d) => new Date(d.getTime() - mins * MINUTE);
    await bookingModel.update(id, {
      createdAt: back(b.createdAt),
      expiresAt: back(b.expiresAt),
      ...(b.checkoutExpiresAt && { checkoutExpiresAt: back(b.checkoutExpiresAt) }),
    });
  }
  const capOf = (b) => b.createdAt.getTime() + 50 * MINUTE;

  describe('tope absoluto de retención (50 min desde createdAt)', () => {
    it('abrir, expirar y abrir otro intento acaba en 409 y nunca pasa de 50 min', async () => {
      await seedBooking('bk-a');
      const res1 = await checkout('bk-a');
      assert.equal(res1.status, 200);
      let b = await bookingModel.findById('bk-a');
      assert.ok(b.expiresAt.getTime() <= capOf(b));
      stripe.sessions.get('cs_test_1').status = 'expired';
      await age('bk-a', 16);
      const res2 = await checkout('bk-a');
      assert.equal(res2.status, 200);
      assert.equal(res2.body.sesionId, 'cs_test_2');
      b = await bookingModel.findById('bk-a');
      assert.ok(b.expiresAt.getTime() <= capOf(b));
      stripe.sessions.get('cs_test_2').status = 'expired';
      await age('bk-a', 16);
      const res3 = await checkout('bk-a');
      assert.equal(res3.status, 409);
      assert.equal(res3.body.error.code, 'BOOKING_EXPIRED');
      assert.match(res3.body.error.message, /reserva/i);
      assert.equal(stripe.calls.create.length, 2);
      b = await bookingModel.findById('bk-a');
      assert.ok(b.expiresAt.getTime() <= capOf(b));
    });

    it('reutilizar una sesión abierta sigue permitido y no amplía nada', async () => {
      await seedBooking('bk-a');
      const primera = await checkout('bk-a');
      await age('bk-a', 20);
      const antes = (await bookingModel.findById('bk-a')).expiresAt.getTime();
      const segunda = await checkout('bk-a');
      assert.equal(segunda.status, 200);
      assert.equal(segunda.body.sesionId, primera.body.sesionId);
      assert.equal((await bookingModel.findById('bk-a')).expiresAt.getTime(), antes);
      assert.equal(stripe.calls.create.length, 1);
    });

    it('sin createdAt válido no se abre intento ni se amplía (409)', async () => {
      await seedBooking('bk-a', { createdAt: null });
      const res = await checkout('bk-a');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'BOOKING_EXPIRED');
      assert.equal(stripe.calls.create.length, 0);
    });

    it('extendPendingExpiry recorta al tope y rechaza si no hay createdAt válido', async () => {
      await seedBooking('bk-a', { expiresAt: minutes(5) });
      const res = await bookingsService.extendPendingExpiry('bk-a', minutes(120));
      const b = await bookingModel.findById('bk-a');
      assert.equal(res.getTime(), capOf(b));
      assert.equal(b.expiresAt.getTime(), capOf(b));
      await seedBooking('bk-b', { createdAt: null, inicio: 14, fin: 15 });
      await assert.rejects(
        bookingsService.extendPendingExpiry('bk-b', minutes(20)),
        (e) => e.status === 409 && e.code === 'BOOKING_EXPIRED',
      );
    });

    it('si crear la sesión falla tras ampliar, la retención sigue acotada', async () => {
      await seedBooking('bk-a');
      stripe.failCreate = true;
      assert.equal((await checkout('bk-a')).status, 502);
      const b = await bookingModel.findById('bk-a');
      assert.ok(b.expiresAt.getTime() <= capOf(b));
    });
  });

  describe('reembolso: charge_already_refunded y reproceso', () => {
    beforeEach(() => {
      defaultAttempt = 1;
    });

    it('charge_already_refunded cuenta como éxito: REFUNDED sin refundPending', async () => {
      await seedBooking('bk-a', { status: 'CANCELLED', expiresAt: null, claims: false });
      stripe.failRefund = true;
      stripe.refundError = { code: 'charge_already_refunded' };
      const res = await webhook(completed('bk-a'));
      assert.equal(res.status, 200);
      const pago = await paymentModel.findById('cs_test_paid');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundPending, false);
    });

    it('otro fallo del reembolso conserva refundPending: true', async () => {
      await seedBooking('bk-a', { status: 'CANCELLED', expiresAt: null, claims: false });
      stripe.failRefund = true;
      stripe.refundError = { code: 'api_error' };
      assert.equal((await webhook(completed('bk-a'))).status, 500);
      assert.equal((await paymentModel.findById('cs_test_paid')).refundPending, true);
    });

    it('reprocessRefund reprocesa un pago pendiente con la clave refund:{id}:1 y es idempotente', async () => {
      await paymentModel.create(
        {
          bookingId: 'bk-a',
          amount: 50,
          currency: 'EUR',
          provider: 'STRIPE',
          providerPaymentId: 'pi_x',
          status: 'SUCCEEDED',
          refundPending: true,
          refundReason: 'SLOT_TAKEN',
        },
        { id: 'cs_x' },
      );
      assert.deepEqual(await reprocessRefund('cs_x'), { id: 'cs_x', estado: 'REFUNDED' });
      assert.equal(stripe.calls.refunds.length, 1);
      assert.equal(stripe.calls.refunds[0].options.idempotencyKey, 'refund:cs_x:1');
      assert.equal(stripe.calls.refunds[0].params.payment_intent, 'pi_x');
      assert.equal((await paymentModel.findById('cs_x')).refundPending, false);
      await reprocessRefund('cs_x');
      assert.equal(stripe.calls.refunds.length, 1);
    });
  });

  describe('validación del evento (se ignora con 200 sin escribir ni reembolsar)', () => {
    beforeEach(() => {
      defaultAttempt = 1;
    });

    function withSession(e, changes) {
      return { ...e, data: { object: { ...e.data.object, ...changes } } };
    }
    function withAttempt(e, attempt) {
      const { bookingId } = e.data.object.metadata;
      return withSession(e, { metadata: { bookingId, attempt } });
    }

    const mutations = {
      'evento live': (e) => ({ ...e, livemode: true }),
      'evento sin livemode': ({ livemode: _l, ...e }) => e,
      'sesión live': (e) => withSession(e, { livemode: true }),
      'modo subscription': (e) => withSession(e, { mode: 'subscription' }),
      'client_reference_id distinto': (e) => withSession(e, { client_reference_id: 'otra' }),
      'intento 0': (e) => withAttempt(e, '0'),
      'intento no numérico': (e) => withAttempt(e, 'abc'),
      'intento mayor que el de la reserva': (e) => withAttempt(e, '2'),
      'sin intento': (e) => withAttempt(e, undefined),
    };

    for (const [name, mutate] of Object.entries(mutations)) {
      it(`completed: ${name}`, async () => {
        await seedBooking('bk-a');
        const res = await webhook(mutate(completed('bk-a')));
        assert.equal(res.status, 200);
        assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
        assert.equal((await paymentModel.listByBooking('bk-a')).length, 0);
        assert.equal(stripe.calls.refunds.length, 0);
        assert.equal(warned.length, 1);
        assert.match(warned[0], /checkout\.session\.completed/);
        assert.ok(!warned[0].includes('pi_test_1') && !warned[0].includes('bk-a'));
      });
    }

    it('expired: un evento live o con intento no válido no expira la reserva', async () => {
      await seedBooking('bk-a');
      const base = eventOf('checkout.session.expired', {
        id: 'cs_test_exp',
        livemode: false,
        mode: 'payment',
        client_reference_id: 'bk-a',
        metadata: { bookingId: 'bk-a', attempt: '1' },
      });
      await webhook({ ...base, livemode: true });
      await webhook(withAttempt(base, '0'));
      await webhook(withAttempt(base, '5'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
      assert.equal(warned.length, 3);
      assert.equal((await webhook(base)).status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
    });

    it('un intento anterior legítimo sigue siendo pagable', async () => {
      await seedBooking('bk-a', { attempt: 3 });
      await webhook(completed('bk-a', { metadata: { bookingId: 'bk-a', attempt: '1' } }));
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await paymentModel.findById('cs_test_paid')).status, 'SUCCEEDED');
    });
  });

  describe('claves, firma y casos límite', () => {
    it('solo se aceptan sk_test_ y rk_test_', () => {
      setStripeForTests(null);
      for (const [key, ok] of [
        ['sk_test_abc', true],
        ['rk_test_abc', true],
        ['sk_live_abc', false],
        ['rk_live_abc', false],
        ['pk_test_abc', false],
      ]) {
        process.env.STRIPE_SECRET_KEY = key;
        assert.equal(Boolean(getStripe()), ok, key);
      }
    });

    it('webhook: sin cabecera de firma 400 aunque falte el secreto; con firma y sin secreto 503', async () => {
      setStripeForTests({ client: stripe, webhookSecret: undefined });
      const sinFirma = await webhook(completed('bk-a'), { signature: null });
      assert.equal(sinFirma.status, 400);
      assert.equal(sinFirma.body.error.code, 'INVALID_SIGNATURE');
      assert.equal((await webhook(completed('bk-a'))).status, 503);
    });

    it('409 BOOKING_STARTED si la reserva ya ha empezado y no se crea sesión', async () => {
      await seedBooking('bk-a', { fecha: '2020-01-01' });
      const res = await checkout('bk-a');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'BOOKING_STARTED');
      assert.equal(stripe.calls.create.length, 0);
    });

    it('idempotency_key_in_use responde 409 PAYMENT_IN_PROGRESS, no 502', async () => {
      await seedBooking('bk-a');
      stripe.failCreate = true;
      stripe.createError = { code: 'idempotency_key_in_use', type: 'StripeIdempotencyError' };
      const res = await checkout('bk-a');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYMENT_IN_PROGRESS');
      assert.match(res.body.error.message, /inténtalo de nuevo/);
    });
  });

  describe('pago tardío: fichas sustituibles (misma regla que readSlotPlan)', () => {
    beforeEach(() => {
      defaultAttempt = 1;
    });
    const ficha = (hour, extra) =>
      occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour, ...extra },
        { id: occupancyModel.slotId('r-free', FUT, hour) },
      );
    const vieja = { status: 'EXPIRED', expiresAt: minutes(-20), claims: false };

    it('una ficha de una reserva cancelada se sustituye y se confirma', async () => {
      await seedBooking('bk-a', vieja);
      await seedBooking('bk-c', {
        status: 'CANCELLED',
        expiresAt: null,
        claims: false,
        inicio: 11,
        fin: 12,
      });
      await ficha(11, { bookingId: 'bk-c' });
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await slot(10)).bookingId, 'bk-a');
      assert.equal((await slot(11)).bookingId, 'bk-a');
      assert.equal((await bookingModel.findById('bk-c')).status, 'CANCELLED');
    });

    it('una ficha de una pendiente vencida se sustituye, la expira y libera sus otras fichas', async () => {
      await seedBooking('bk-a', vieja);
      await seedBooking('bk-p', { expiresAt: minutes(-1), inicio: 11, fin: 13 });
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await bookingModel.findById('bk-p')).status, 'EXPIRED');
      assert.equal((await slot(11)).bookingId, 'bk-a');
      assert.equal(await slot(12), null);
    });

    it('una ficha de una reserva inexistente no se sustituye: reembolso', async () => {
      await seedBooking('bk-a', vieja);
      await ficha(11, { bookingId: 'fantasma' });
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
      assert.equal((await paymentModel.findById('cs_test_paid')).refundReason, 'SLOT_TAKEN');
      assert.equal((await slot(11)).bookingId, 'fantasma');
      assert.equal(await slot(10), null);
    });

    it('una ficha de una reserva confirmada nunca se sustituye (sin doble ocupación)', async () => {
      await seedBooking('bk-a', vieja);
      await seedBooking('bk-v', {
        status: 'CONFIRMED',
        expiresAt: null,
        claims: false,
        inicio: 12,
        fin: 13,
      });
      // Ficha de bk-v en una hora de bk-a (dato incoherente): la reserva viva manda.
      await ficha(11, { bookingId: 'bk-v' });
      await webhook(completed('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'EXPIRED');
      assert.equal((await slot(11)).bookingId, 'bk-v');
      assert.equal((await paymentModel.findById('cs_test_paid')).refundReason, 'SLOT_TAKEN');
    });
  });
});
