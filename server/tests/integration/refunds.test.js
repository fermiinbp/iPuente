// Test de integración: reembolsos y cancelaciones de reservas pagadas con Stripe sustituido por un
// doble (nunca hay llamadas reales). Cubre GET /api/admin/payments, POST /api/admin/payments/:id/refund,
// la cancelación del cliente y de la empresa (reembolso, aviso si Stripe falla, sesión expirada,
// reserva pendiente) y la carrera entre cancelar y el webhook de pago.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import Stripe from 'stripe';

import { setDbForTests } from '../../src/config/config.js';
import { swaggerSpec } from '../../src/config/swagger.js';
import { setStripeForTests } from '../../src/config/stripe.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import { setRateLimitForTests } from '../../src/middlewares/rateLimit.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as paymentModel from '../../src/models/paymentModel.js';
import * as userModel from '../../src/models/userModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { createStripeDouble } from '../helpers/stripeDouble.js';
import { listen, seedPublicData } from '../helpers/publicData.js';

const FUT = '2030-03-12';
const SECRET = 'whsec_test_secret_para_tests';
const at = (fecha, hour) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

const tokens = {
  admin: { uid: 'admin-1', role: 'ADMIN' },
  u1: { uid: 'u1', role: 'CLIENT' },
  u2: { uid: 'u2', role: 'CLIENT' },
  empresa: { uid: 'owner-1', role: 'COMPANY', companyId: 'c1' },
};

describe('Reembolsos y cancelaciones de reservas pagadas', () => {
  let server;
  let baseUrl;
  let stripe;

  async function call(method, path, token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  }
  const refund = (id, token = 'admin') => call('POST', `/api/admin/payments/${id}/refund`, token);
  const cancelCliente = (id, token = 'u1') => call('PATCH', `/api/bookings/${id}/cancel`, token);
  const cancelEmpresa = (id) =>
    call('PATCH', `/api/company/bookings/${id}/cancel`, 'empresa', {
      motivo: 'Obras en el edificio',
    });

  async function webhook(event) {
    const payload = JSON.stringify(event);
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const res = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
      body: payload,
    });
    return { status: res.status, body: await res.json() };
  }
  const paidEvent = (bookingId) => ({
    id: 'evt_1',
    object: 'event',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_pay',
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 5000,
        currency: 'eur',
        payment_intent: 'pi_pay',
        livemode: false,
        mode: 'payment',
        client_reference_id: bookingId,
        metadata: { bookingId, attempt: '1', destination: 'acct_c1' },
      },
    },
  });

  // Reserva de r-free (25 €/h, 10-12 = 50 €) con fichas. Por defecto confirmada y con su pago.
  async function seed(
    id,
    { status = 'CONFIRMED', payment = 'SUCCEEDED', claims = true, extra = {} } = {},
  ) {
    await bookingModel.create(
      {
        code: `IP-${id}`,
        userId: 'u1',
        companyId: 'c1',
        roomId: 'r-free',
        startDate: at(FUT, 10),
        endDate: at(FUT, 12),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status,
        paymentId: payment ? `cs-${id}` : null,
        ...extra,
      },
      { id },
    );
    for (let h = 10; claims && h < 12; h++) {
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour: h, bookingId: id },
        { id: occupancyModel.slotId('r-free', FUT, h) },
      );
    }
    if (payment) {
      await paymentModel.create(
        {
          bookingId: id,
          userId: 'u1',
          amount: 50,
          amountCents: 5000,
          currency: 'EUR',
          provider: 'STRIPE',
          providerPaymentId: `pi-${id}`,
          providerSessionId: `cs-${id}`,
          status: payment,
        },
        { id: `cs-${id}` },
      );
    }
  }
  const slot = (h) => occupancyModel.findById(occupancyModel.slotId('r-free', FUT, h));

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    setTokenVerifier(async (token) => tokens[token]);
    setDbForTests(createFakeFirestore());
    await seedPublicData();
    await userModel.create(
      { name: 'Ana', surname: 'Pérez', email: 'ana@x.es', role: 'CLIENT' },
      { id: 'u1' },
    );
    stripe = createStripeDouble();
    setStripeForTests({ client: stripe, webhookSecret: SECRET });
    mock.method(console, 'error', () => {});
    mock.method(console, 'warn', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    setRateLimitForTests(null);
  });

  after(async () => {
    setStripeForTests(null);
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('documentación', () => {
    it('los endpoints de admin de pagos están documentados con etiqueta Admin y bearerAuth', () => {
      for (const [path, method] of [
        ['/admin/payments', 'get'],
        ['/admin/payments/{id}/refund', 'post'],
      ]) {
        const op = swaggerSpec.paths[path]?.[method];
        assert.ok(op, `falta ${method} ${path}`);
        assert.deepEqual(op.tags, ['Admin']);
        assert.deepEqual(op.security, [{ bearerAuth: [] }]);
      }
    });
  });

  describe('permisos de /api/admin/payments', () => {
    it('401 sin token y 403 a cliente y empresa, sin llamar a Stripe', async () => {
      await seed('bk-a');
      for (const [method, path] of [
        ['GET', '/api/admin/payments'],
        ['POST', '/api/admin/payments/cs-bk-a/refund'],
      ]) {
        assert.equal((await call(method, path, null)).status, 401);
        assert.equal((await call(method, path, 'u1')).status, 403);
        assert.equal((await call(method, path, 'empresa')).status, 403);
      }
      assert.equal(stripe.calls.refunds.length, 0);
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'SUCCEEDED');
    });

    it('400 con estado, página o id no válidos', async () => {
      assert.equal((await call('GET', '/api/admin/payments?estado=NADA', 'admin')).status, 400);
      assert.equal((await call('GET', '/api/admin/payments?page=0', 'admin')).status, 400);
      assert.equal((await call('GET', '/api/admin/payments?page=26', 'admin')).status, 400);
      assert.equal((await refund('a.b')).status, 400);
    });
  });

  describe('GET /api/admin/payments', () => {
    it('lista los pagos con reserva y cliente, filtra por estado y no filtra datos de Stripe', async () => {
      await seed('bk-a');
      await seed('bk-b', { payment: 'REFUNDED', claims: false });
      await paymentModel.update('cs-bk-a', { refundPending: true, refundReason: 'SLOT_TAKEN' });
      const todos = await call('GET', '/api/admin/payments', 'admin');
      assert.equal(todos.status, 200);
      assert.equal(todos.body.total, 2);
      assert.equal(todos.body.page, 1);
      assert.equal(todos.body.limit, 20);
      const a = todos.body.pagos.find((p) => p.id === 'cs-bk-a');
      assert.equal(a.importe, 50);
      assert.equal(a.moneda, 'EUR');
      assert.equal(a.estado, 'SUCCEEDED');
      assert.equal(a.reembolsoPendiente, true);
      assert.equal(a.motivoReembolso, 'SLOT_TAKEN');
      assert.deepEqual(a.reserva, { id: 'bk-a', codigo: 'IP-bk-a', estado: 'CONFIRMED' });
      assert.deepEqual(a.cliente, { nombre: 'Ana Pérez', email: 'ana@x.es' });
      const text = JSON.stringify(todos.body);
      assert.ok(!text.includes('pi-bk-a') && !text.includes('providerPaymentId'));
      const filtrado = await call('GET', '/api/admin/payments?estado=REFUNDED', 'admin');
      assert.deepEqual(
        filtrado.body.pagos.map((p) => p.id),
        ['cs-bk-b'],
      );
    });
  });

  describe('POST /api/admin/payments/:id/refund', () => {
    it('reembolsa por completo: pago REFUNDED, reserva CANCELLED por admin y horas libres', async () => {
      await seed('bk-a');
      const { status, body } = await refund('cs-bk-a');
      assert.equal(status, 200);
      assert.deepEqual(body, {
        id: 'cs-bk-a',
        estado: 'REFUNDED',
        reserva: { id: 'bk-a', estado: 'CANCELLED' },
      });
      const pago = await paymentModel.findById('cs-bk-a');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundPending, false);
      assert.equal(pago.refundId, 're_1');
      const reserva = await bookingModel.findById('bk-a');
      assert.equal(reserva.status, 'CANCELLED');
      assert.equal(reserva.cancelledBy, 'ADMIN');
      assert.equal(await slot(10), null);
      assert.equal(await slot(11), null);
      assert.equal(stripe.calls.refunds.length, 1);
      assert.equal(stripe.calls.refunds[0].params.payment_intent, 'pi-bk-a');
      assert.equal(stripe.calls.refunds[0].params.amount, undefined, 'siempre total');
      assert.equal(stripe.calls.refunds[0].options.idempotencyKey, 'refund:cs-bk-a:1');
    });

    it('es idempotente: repetirlo sobre un pago reembolsado no vuelve a llamar a Stripe', async () => {
      await seed('bk-a');
      await refund('cs-bk-a');
      const otra = await refund('cs-bk-a');
      assert.equal(otra.status, 200);
      assert.equal(otra.body.estado, 'REFUNDED');
      assert.equal(otra.body.yaReembolsado, true);
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('un doble clic simultáneo reembolsa una sola vez (misma clave y mismo reembolso)', async () => {
      await seed('bk-a');
      const [a, b] = await Promise.all([refund('cs-bk-a'), refund('cs-bk-a')]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      const keys = new Set(stripe.calls.refunds.map((c) => c.options.idempotencyKey));
      assert.deepEqual([...keys], ['refund:cs-bk-a:1']);
      assert.equal((await paymentModel.findById('cs-bk-a')).refundId, 're_1');
    });

    it('404 si el pago no existe', async () => {
      const { status, body } = await refund('nada');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(stripe.calls.refunds.length, 0);
    });

    it('409 PAYMENT_NOT_REFUNDABLE si el pago no está cobrado', async () => {
      for (const estado of ['PENDING', 'FAILED']) {
        await seed(`bk-${estado}`, { payment: estado, claims: false });
        const { status, body } = await refund(`cs-bk-${estado}`);
        assert.equal(status, 409, estado);
        assert.equal(body.error.code, 'PAYMENT_NOT_REFUNDABLE');
        assert.equal((await bookingModel.findById(`bk-${estado}`)).status, 'CONFIRMED');
      }
      assert.equal(stripe.calls.refunds.length, 0);
    });

    it('503 PAYMENTS_UNAVAILABLE sin Stripe y no toca la reserva ni el pago', async () => {
      await seed('bk-a');
      setStripeForTests(null);
      const { status, body } = await refund('cs-bk-a');
      assert.equal(status, 503);
      assert.equal(body.error.code, 'PAYMENTS_UNAVAILABLE');
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      assert.equal((await paymentModel.findById('cs-bk-a')).refundPending, undefined);
    });

    it('si Stripe falla responde 502, deja refundPending y el reintento lo completa con clave nueva', async () => {
      await seed('bk-a');
      stripe.failRefund = true;
      stripe.refundError = { type: 'StripeInvalidRequestError', code: 'parameter_invalid' };
      const fallo = await refund('cs-bk-a');
      assert.equal(fallo.status, 502);
      assert.equal(fallo.body.error.code, 'PAYMENTS_ERROR');
      assert.ok(!JSON.stringify(fallo.body).includes('detalle-secreto'));
      const pendiente = await paymentModel.findById('cs-bk-a');
      assert.equal(pendiente.status, 'SUCCEEDED');
      assert.equal(pendiente.refundPending, true);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CANCELLED');
      stripe.failRefund = false;
      const ok = await refund('cs-bk-a');
      assert.equal(ok.status, 200);
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'REFUNDED');
      assert.deepEqual(
        stripe.calls.refunds.map((c) => c.options.idempotencyKey),
        ['refund:cs-bk-a:1', 'refund:cs-bk-a:2'],
      );
    });

    it('con un error de resultado incierto el reintento reutiliza la misma clave', async () => {
      await seed('bk-a');
      stripe.failRefund = true;
      stripe.refundError = { type: 'StripeConnectionError' };
      assert.equal((await refund('cs-bk-a')).status, 502);
      stripe.failRefund = false;
      assert.equal((await refund('cs-bk-a')).status, 200);
      assert.deepEqual(
        stripe.calls.refunds.map((c) => c.options.idempotencyKey),
        ['refund:cs-bk-a:1', 'refund:cs-bk-a:1'],
      );
    });

    it('reintenta un pago con refundPending de una reserva ya cancelada sin tocar la reserva', async () => {
      await seed('bk-a', { status: 'CANCELLED' });
      await paymentModel.update('cs-bk-a', {
        refundPending: true,
        refundReason: 'BOOKING_CANCELLED',
      });
      const { status, body } = await refund('cs-bk-a');
      assert.equal(status, 200);
      assert.equal(body.reserva.estado, 'CANCELLED');
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'REFUNDED');
      assert.equal(stripe.calls.refunds[0].params.metadata.motivo, 'BOOKING_CANCELLED');
    });
  });

  describe('cancelación de una reserva pagada', () => {
    it('el cliente cancela, libera las horas y se reembolsa el pago', async () => {
      await seed('bk-a');
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.deepEqual(body, { id: 'bk-a', estado: 'CANCELLED', reembolso: 'REFUNDED' });
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'REFUNDED');
      assert.equal(await slot(10), null);
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('la empresa cancela una confirmada pagada y se reembolsa', async () => {
      await seed('bk-a');
      const { status, body } = await cancelEmpresa('bk-a');
      assert.equal(status, 200);
      assert.equal(body.estado, 'CANCELLED');
      assert.equal(body.motivo, 'Obras en el edificio');
      assert.equal(body.reembolso, 'REFUNDED');
      const reserva = await bookingModel.findById('bk-a');
      assert.equal(reserva.cancelledBy, 'COMPANY');
      assert.equal(reserva.cancelReason, 'Obras en el edificio');
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'REFUNDED');
    });

    it('si Stripe falla la cancelación se mantiene, responde 200 con aviso y queda refundPending', async () => {
      await seed('bk-a');
      stripe.failRefund = true;
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.equal(body.estado, 'CANCELLED');
      assert.equal(body.reembolso, 'PENDING');
      assert.match(body.aviso, /reembolso/);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CANCELLED');
      assert.equal(await slot(10), null);
      const pago = await paymentModel.findById('cs-bk-a');
      assert.equal(pago.status, 'SUCCEEDED');
      assert.equal(pago.refundPending, true);
      // El admin lo puede completar después.
      stripe.failRefund = false;
      assert.equal((await refund('cs-bk-a')).status, 200);
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'REFUNDED');
    });

    it('sin Stripe disponible también cancela con aviso', async () => {
      await seed('bk-a');
      setStripeForTests(null);
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.equal(body.reembolso, 'PENDING');
      assert.equal((await paymentModel.findById('cs-bk-a')).refundPending, true);
    });

    it('una reserva sin paymentId (seed o 0 €) se cancela sin reembolso ni llamadas a Stripe', async () => {
      await seed('bk-a', { payment: null });
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.deepEqual(body, { id: 'bk-a', estado: 'CANCELLED' });
      assert.equal(stripe.calls.refunds.length, 0);
      assert.equal(stripe.calls.expire.length, 0);
    });

    it('una reserva pendiente se cancela y expira su sesión de Checkout', async () => {
      await seed('bk-a', {
        status: 'PENDING_PAYMENT',
        payment: null,
        extra: {
          expiresAt: new Date(Date.now() + 600000),
          checkoutAttempt: 1,
          checkoutSessionId: 'cs_test_9',
        },
      });
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.deepEqual(body, { id: 'bk-a', estado: 'CANCELLED' });
      assert.deepEqual(stripe.calls.expire, ['cs_test_9']);
      assert.equal(await slot(10), null);
    });

    it('si expirar la sesión falla, la cancelación se mantiene', async () => {
      await seed('bk-a', {
        status: 'PENDING_PAYMENT',
        payment: null,
        extra: {
          expiresAt: new Date(Date.now() + 600000),
          checkoutAttempt: 1,
          checkoutSessionId: 'cs_test_9',
        },
      });
      stripe.failExpire = true;
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.equal(body.estado, 'CANCELLED');
      assert.equal((await bookingModel.findById('bk-a')).status, 'CANCELLED');
    });

    it('la empresa no cancela una reserva PENDING_PAYMENT: 400 BOOKING_NOT_CANCELLABLE sin cambios', async () => {
      await seed('bk-a', {
        status: 'PENDING_PAYMENT',
        payment: null,
        extra: { expiresAt: new Date(Date.now() + 600000) },
      });
      const { status, body } = await cancelEmpresa('bk-a');
      assert.equal(status, 400);
      assert.equal(body.error.code, 'BOOKING_NOT_CANCELLABLE');
      assert.equal((await bookingModel.findById('bk-a')).status, 'PENDING_PAYMENT');
      assert.equal((await slot(10)).bookingId, 'bk-a');
      assert.equal(stripe.calls.expire.length, 0);
    });
  });

  describe('cancelar contra el webhook de pago', () => {
    const pending = () =>
      seed('bk-a', {
        status: 'PENDING_PAYMENT',
        payment: null,
        extra: {
          expiresAt: new Date(Date.now() + 600000),
          checkoutAttempt: 1,
          checkoutSessionId: 'cs_pay',
        },
      });

    it('cancelar y luego llegar el pago: el webhook reembolsa y la reserva sigue cancelada', async () => {
      await pending();
      await cancelCliente('bk-a');
      const res = await webhook(paidEvent('bk-a'));
      assert.equal(res.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CANCELLED');
      const pago = await paymentModel.findById('cs_pay');
      assert.equal(pago.status, 'REFUNDED');
      assert.equal(pago.refundReason, 'BOOKING_CANCELLED');
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('pagar y luego cancelar: la cancelación reembolsa el pago', async () => {
      await pending();
      await webhook(paidEvent('bk-a'));
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
      const { body } = await cancelCliente('bk-a');
      assert.equal(body.reembolso, 'REFUNDED');
      assert.equal((await paymentModel.findById('cs_pay')).status, 'REFUNDED');
      assert.equal(stripe.calls.refunds.length, 1);
    });

    it('cancelar y pagar a la vez: un solo reembolso y reserva cancelada', async () => {
      await pending();
      const [c, w] = await Promise.all([cancelCliente('bk-a'), webhook(paidEvent('bk-a'))]);
      assert.equal(c.status, 200);
      assert.equal(w.status, 200);
      assert.equal((await bookingModel.findById('bk-a')).status, 'CANCELLED');
      assert.equal((await paymentModel.findById('cs_pay')).status, 'REFUNDED');
      const keys = new Set(stripe.calls.refunds.map((r) => r.options.idempotencyKey));
      assert.equal(keys.size, 1);
      assert.equal(await slot(10), null);
    });
  });

  describe('pagos sin providerPaymentId o de otra reserva', () => {
    it('sin providerPaymentId: cancela, marca refundPending, responde PENDING con aviso y sigue en el panel', async () => {
      await seed('bk-a');
      await paymentModel.update('cs-bk-a', { providerPaymentId: null });
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.equal(body.estado, 'CANCELLED');
      assert.equal(body.reembolso, 'PENDING');
      assert.ok(body.aviso);
      assert.equal(stripe.calls.refunds.length, 0);
      const pago = await paymentModel.findById('cs-bk-a');
      assert.equal(pago.status, 'SUCCEEDED');
      assert.equal(pago.refundPending, true);
      const lista = await call('GET', '/api/admin/payments', 'admin');
      const item = lista.body.pagos.find((p) => p.id === 'cs-bk-a');
      assert.equal(item.reembolsoPendiente, true);
    });

    it('si el pago es de otra reserva no se reembolsa y se registran solo ids y motivo', async () => {
      const logged = [];
      mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
      await seed('bk-a');
      await paymentModel.update('cs-bk-a', { bookingId: 'otra-reserva' });
      const { status, body } = await cancelCliente('bk-a');
      assert.equal(status, 200);
      assert.deepEqual(body, { id: 'bk-a', estado: 'CANCELLED' });
      assert.equal(stripe.calls.refunds.length, 0);
      const pago = await paymentModel.findById('cs-bk-a');
      assert.equal(pago.status, 'SUCCEEDED');
      assert.equal(pago.refundPending, undefined);
      const log = logged.join(' | ');
      assert.match(log, /cs-bk-a/);
      assert.match(log, /bk-a/);
      assert.match(log, /BOOKING_MISMATCH/);
      assert.ok(!log.includes('pi-bk-a'));
    });
  });

  describe('reembolso de admin de una reserva COMPLETED', () => {
    it('reembolsa el pago pero conserva la reserva COMPLETED y su occupancy', async () => {
      await seed('bk-a', { status: 'COMPLETED' });
      const { status, body } = await refund('cs-bk-a');
      assert.equal(status, 200);
      assert.deepEqual(body, {
        id: 'cs-bk-a',
        estado: 'REFUNDED',
        reserva: { id: 'bk-a', estado: 'COMPLETED' },
      });
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'REFUNDED');
      const reserva = await bookingModel.findById('bk-a');
      assert.equal(reserva.status, 'COMPLETED');
      assert.equal(reserva.cancelledBy, undefined);
      assert.equal((await slot(10)).bookingId, 'bk-a');
      assert.equal((await slot(11)).bookingId, 'bk-a');
    });
  });

  describe('límites de peticiones por uid', () => {
    it('POST /bookings: 429 RATE_LIMITED al pasar el límite, sin afectar a otro uid', async () => {
      setRateLimitForTests({ bookingCreate: { limit: 1, windowMs: 60_000 } });
      const body = { roomId: 'no-existe', fecha: FUT, inicio: 10, fin: 12 };
      const post = async (t) => (await call('POST', '/api/bookings', t, body)).status;
      assert.equal(await post('u1'), 404);
      assert.equal(await post('u1'), 429);
      assert.equal(await post('u2'), 404);
    });

    it('cancelar (cliente y empresa): 429 RATE_LIMITED al pasar el límite por uid', async () => {
      setRateLimitForTests({ bookingCancel: { limit: 1, windowMs: 60_000 } });
      assert.equal((await cancelCliente('nada')).status, 404);
      assert.equal((await cancelCliente('nada')).status, 429);
      assert.equal((await cancelCliente('nada', 'u2')).status, 404);
      assert.equal((await cancelEmpresa('nada')).status, 404);
      assert.equal((await cancelEmpresa('nada')).status, 429);
    });

    it('reembolso de admin: 429 RATE_LIMITED al pasar el límite y no llama a Stripe', async () => {
      setRateLimitForTests({ adminRefund: { limit: 1, windowMs: 60_000 } });
      await seed('bk-a');
      assert.equal((await refund('nada')).status, 404);
      const limitado = await refund('cs-bk-a');
      assert.equal(limitado.status, 429);
      assert.equal(limitado.body.error.code, 'RATE_LIMITED');
      assert.equal(stripe.calls.refunds.length, 0);
      assert.equal((await paymentModel.findById('cs-bk-a')).status, 'SUCCEEDED');
    });
  });
});
