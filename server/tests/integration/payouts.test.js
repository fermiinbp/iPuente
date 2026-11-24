// Test de integración de los cobros de las empresas con Stripe Connect (DAT044): /api/company/payouts*
// (estado, alta, movimientos y panel), la exigencia de cuenta activa al publicar plantas, reservar y
// pagar, el destino del cobro (transfer_data), el pago guardado con su empresa y destino y el reembolso
// con reverse_transfer. Todo con Stripe, token y Firestore sustituidos por dobles (sin llamadas reales).
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import Stripe from 'stripe';

import { setDbForTests } from '../../src/config/config.js';
import { swaggerSpec } from '../../src/config/swagger.js';
import { setStripeForTests } from '../../src/config/stripe.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import { setRateLimitForTests } from '../../src/middlewares/rateLimit.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as paymentModel from '../../src/models/paymentModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { backfillPaymentCompany } from '../../scripts/backfillPaymentCompany.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen, seedPublicData } from '../helpers/publicData.js';
import { createStripeDouble } from '../helpers/stripeDouble.js';

const FUT = '2030-03-12';
const SECRET = 'whsec_test_payouts';
const at = (fecha, hour) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  b: { uid: 'ub', role: 'COMPANY', companyId: 'c-b' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  susp: { uid: 'us', role: 'COMPANY', companyId: 'c-susp' },
  cliente: { uid: 'u1', role: 'CLIENT' },
  otro: { uid: 'u2', role: 'CLIENT' },
  admin: { uid: 'adm', role: 'ADMIN' },
};

describe('Cobros de empresas con Stripe Connect', () => {
  let server;
  let baseUrl;
  let stripe;
  let seq = 0;

  async function call(method, path, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  }
  const get = (path, token = 'a') => call('GET', path, { token });
  const post = (path, token = 'a', body) => call('POST', path, { token, body });

  async function webhook(event) {
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const res = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
      body: payload,
    });
    return { status: res.status, body: await res.json() };
  }

  // Reserva pendiente de pago de la sala r-free (25 €/h, empresa c1) del cliente u1.
  async function seedBooking(id, { claims = true, ...extra } = {}) {
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
        status: 'PENDING_PAYMENT',
        paymentId: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ...extra,
      },
      { id },
    );
    await bookingModel.update(id, { createdAt: new Date() });
    for (let h = 10; claims && h < 12; h++) {
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour: h, bookingId: id },
        { id: occupancyModel.slotId('r-free', FUT, h) },
      );
    }
  }

  // Planta de c-a con sus salas: [{ id, extra }] (de pago por defecto, 25 €/h).
  async function seedFloor(floorId, rooms) {
    await floorModel.create(
      {
        companyId: 'c-a',
        buildingId: 'b-a',
        name: floorId,
        level: 0,
        status: 'DRAFT',
        ancho: 1000,
        alto: 600,
        origen: 'manual',
        salas: rooms.map(({ id }, i) => ({
          id,
          codigo: id,
          nombre: id,
          tipo: 'sala',
          x: i * 120,
          y: 0,
          w: 100,
          h: 100,
        })),
      },
      { id: floorId },
    );
    for (const { id, extra } of rooms) {
      await roomModel.create(
        {
          companyId: 'c-a',
          buildingId: 'b-a',
          floorId,
          name: id,
          code: id,
          type: 'sala',
          price: 25,
          isFree: false,
          capacity: 8,
          bookable: true,
          status: 'ACTIVE',
          ...extra,
        },
        { id },
      );
    }
  }
  const FREE = { price: null, isFree: true };

  // Pago de la empresa dada, con su reserva (para los movimientos y los reembolsos).
  async function seedPayment(
    id,
    { companyId = 'c-a', legacy = false, bookingId = `bk-${id}`, ...extra } = {},
  ) {
    await bookingModel.create(
      {
        code: `IP-${++seq}`,
        userId: 'u-secreto',
        companyId,
        roomId: 'r-free',
        startDate: at(FUT, 10),
        endDate: at(FUT, 12),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status: 'CONFIRMED',
        paymentId: id,
      },
      { id: bookingId },
    );
    await paymentModel.create(
      {
        bookingId,
        userId: 'u-secreto',
        amount: 50,
        amountCents: 5000,
        currency: 'EUR',
        provider: 'STRIPE',
        providerPaymentId: `pi_${id}`,
        providerSessionId: id,
        status: 'SUCCEEDED',
        ...(!legacy && { companyId }),
        ...extra,
      },
      { id },
    );
  }

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    seq = 0;
    delete process.env.STRIPE_SECRET_KEY;
    setTokenVerifier(async (token) => tokens[token]);
    setDbForTests(createFakeFirestore());
    await seedPublicData();
    await companyModel.create({ name: 'A', status: 'APPROVED', verified: true }, { id: 'c-a' });
    await companyModel.create({ name: 'B', status: 'APPROVED', verified: true }, { id: 'c-b' });
    await companyModel.create({ name: 'P', status: 'PENDING', verified: false }, { id: 'c-pend' });
    await companyModel.create(
      { name: 'S', status: 'SUSPENDED', verified: false },
      { id: 'c-susp' },
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
    it('los cuatro endpoints están documentados con etiqueta Empresa y bearerAuth', () => {
      for (const [path, method] of [
        ['/company/payouts', 'get'],
        ['/company/payouts/onboarding', 'post'],
        ['/company/payouts/movements', 'get'],
        ['/company/payouts/dashboard', 'post'],
      ]) {
        const op = swaggerSpec.paths[path]?.[method];
        assert.ok(op, `falta ${method} ${path}`);
        assert.deepEqual(op.tags, ['Empresa']);
        assert.deepEqual(op.security, [{ bearerAuth: [] }]);
      }
    });

    it('el resumen de admin aclara que ingresosMes es volumen cobrado', () => {
      const text = JSON.stringify(swaggerSpec.paths['/admin/summary'].get);
      assert.match(text, /volumen cobrado/);
    });
  });

  describe('permisos', () => {
    const endpoints = [
      ['GET', '/api/company/payouts'],
      ['POST', '/api/company/payouts/onboarding'],
      ['GET', '/api/company/payouts/movements'],
      ['POST', '/api/company/payouts/dashboard'],
    ];

    it('401 sin token y 403 a cliente y admin', async () => {
      for (const [method, path] of endpoints) {
        assert.equal((await call(method, path)).status, 401, path);
        assert.equal((await call(method, path, { token: 'cliente' })).status, 403, path);
        assert.equal((await call(method, path, { token: 'admin' })).status, 403, path);
      }
      assert.equal(stripe.calls.accountCreate.length, 0);
    });

    it('403 COMPANY_NOT_APPROVED a una empresa pendiente o suspendida', async () => {
      for (const token of ['pend', 'susp']) {
        for (const [method, path] of endpoints) {
          const res = await call(method, path, { token });
          assert.equal(res.status, 403, path);
          assert.equal(res.body.error.code, 'COMPANY_NOT_APPROVED');
        }
      }
      assert.equal(stripe.calls.accountCreate.length, 0);
    });

    it('400 con parámetros desconocidos', async () => {
      assert.equal((await get('/api/company/payouts?x=1')).status, 400);
      assert.equal((await post('/api/company/payouts/onboarding?x=1')).status, 400);
    });
  });

  describe('GET /api/company/payouts', () => {
    it('sin cuenta: none, sin llamar a Stripe', async () => {
      const res = await get('/api/company/payouts');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        conectada: false,
        estado: 'none',
        requisitosPendientes: false,
        comprobadoEn: null,
      });
      assert.equal(stripe.calls.accountRetrieve.length, 0);
    });

    it('consulta a Stripe y guarda el estado: pending, active y restricted', async () => {
      await companyModel.update('c-a', { stripeAccountId: 'acct_a', stripeAccountStatus: 'none' });
      const cases = [
        ['pending', 'pending'],
        ['active', 'active'],
        ['restricted', 'restricted'],
        ['rejected', 'restricted'],
        ['unsupported', 'restricted'],
      ];
      for (const [stripeStatus, expected] of cases) {
        stripe.connected.set('acct_a', stripeStatus);
        const res = await get('/api/company/payouts');
        assert.equal(res.status, 200);
        assert.equal(res.body.conectada, true);
        assert.equal(res.body.estado, expected, stripeStatus);
        assert.ok(res.body.comprobadoEn);
        assert.equal((await companyModel.findById('c-a')).stripeAccountStatus, expected);
      }
      const last = stripe.calls.accountRetrieve.at(-1);
      assert.deepEqual(last.params.include, ['configuration.recipient', 'requirements']);
    });

    it('requisitosPendientes es true solo si Stripe espera algo de la empresa', async () => {
      await companyModel.update('c-a', { stripeAccountId: 'acct_a' });
      stripe.connected.set('acct_a', 'pending');
      stripe.requirementsEntries = [{ awaiting_action_from: 'user', description: 'x' }];
      assert.equal((await get('/api/company/payouts')).body.requisitosPendientes, true);
      stripe.requirementsEntries = [{ awaiting_action_from: 'stripe', description: 'x' }];
      assert.equal((await get('/api/company/payouts')).body.requisitosPendientes, false);
    });

    it('si Stripe falla devuelve el último estado guardado, desactualizado y sin detalle', async () => {
      await companyModel.update('c-a', {
        stripeAccountId: 'acct_a',
        stripeAccountStatus: 'pending',
      });
      stripe.failAccountRetrieve = true;
      const res = await get('/api/company/payouts');
      assert.equal(res.status, 200);
      assert.equal(res.body.estado, 'pending');
      assert.equal(res.body.desactualizado, true);
      assert.ok(res.body.aviso);
      assert.doesNotMatch(res.text, /detalle-secreto/);
      // Lo guardado no se da por activo, pero tampoco se pierde si ya lo estaba.
      await companyModel.update('c-a', { stripeAccountStatus: 'active' });
      const again = await get('/api/company/payouts');
      assert.equal(again.body.estado, 'active');
      assert.equal(again.body.desactualizado, true);
    });

    it('sin Stripe configurado responde con lo guardado', async () => {
      await companyModel.update('c-a', {
        stripeAccountId: 'acct_a',
        stripeAccountStatus: 'pending',
      });
      setStripeForTests(null);
      const res = await get('/api/company/payouts');
      assert.equal(res.status, 200);
      assert.equal(res.body.estado, 'pending');
      assert.equal(res.body.desactualizado, true);
      setStripeForTests({ client: stripe, webhookSecret: SECRET });
    });

    it('429 al consultar el estado demasiadas veces por hora (por uid)', async () => {
      setRateLimitForTests({ payoutsRead: { limit: 2, windowMs: 60000 } });
      assert.equal((await get('/api/company/payouts')).status, 200);
      assert.equal((await get('/api/company/payouts')).status, 200);
      assert.equal((await get('/api/company/payouts')).status, 429);
      assert.equal((await get('/api/company/payouts', 'b')).status, 200);
    });

    it('aislamiento: cada empresa ve solo su cuenta', async () => {
      await companyModel.update('c-a', {
        stripeAccountId: 'acct_a',
        stripeAccountStatus: 'active',
      });
      stripe.connected.set('acct_a', 'active');
      assert.equal((await get('/api/company/payouts', 'a')).body.estado, 'active');
      assert.equal((await get('/api/company/payouts', 'b')).body.estado, 'none');
    });
  });

  describe('POST /api/company/payouts/onboarding', () => {
    it('crea la cuenta v2 con los parámetros esperados y devuelve solo la URL', async () => {
      const res = await post('/api/company/payouts/onboarding');
      assert.equal(res.status, 200);
      assert.deepEqual(Object.keys(res.body), ['url']);
      assert.equal(stripe.calls.accountCreate.length, 1);
      const { params, options } = stripe.calls.accountCreate[0];
      assert.match(options.idempotencyKey, /^connect-account:c-a:[0-9a-f]{12}$/);
      assert.deepEqual(params.metadata, { companyId: 'c-a' });
      assert.equal(params.dashboard, 'express');
      assert.equal(params.display_name, 'A');
      assert.deepEqual(params.identity, { country: 'es', entity_type: 'company' });
      assert.deepEqual(params.defaults.responsibilities, {
        fees_collector: 'application',
        losses_collector: 'application',
      });
      assert.deepEqual(params.configuration, {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      });
      assert.equal(params.defaults.currency, 'eur');
      for (const forbidden of ['type', 'on_behalf_of']) assert.equal(forbidden in params, false);
      assert.equal('merchant' in params.configuration, false);
      assert.doesNotMatch(JSON.stringify(params), /card_payments|charges_enabled|payouts_enabled/);
      const company = await companyModel.findById('c-a');
      assert.match(company.stripeAccountId, /^acct_/);
      assert.equal(company.stripeAccountStatus, 'pending');
      assert.equal((await companyModel.findById('c-b')).stripeAccountId, undefined);
    });

    it('el enlace de alta usa solo APP_URL para volver', async () => {
      await post('/api/company/payouts/onboarding');
      const link = stripe.calls.linkCreate[0];
      assert.equal(link.use_case.type, 'account_onboarding');
      assert.equal(
        link.use_case.account_onboarding.return_url,
        'http://localhost:5173/company/settings?tab=cobros&stripe=retorno',
      );
      assert.equal(
        link.use_case.account_onboarding.refresh_url,
        'http://localhost:5173/company/settings?tab=cobros&stripe=refrescar',
      );
    });

    it('no filtra el id de la cuenta (acct_) en ninguna respuesta de la API', async () => {
      // La URL de Stripe puede llevar el id de la cuenta: es de Stripe, no de nuestro JSON.
      assert.deepEqual(Object.keys((await post('/api/company/payouts/onboarding')).body), ['url']);
      const stripeId = (await companyModel.findById('c-a')).stripeAccountId;
      const texts = [];
      texts.push((await get('/api/company/payouts')).text);
      texts.push((await get('/api/companies/me', 'a')).text);
      texts.push((await get('/api/admin/companies/c-a', 'admin')).text);
      texts.push((await get('/api/admin/companies', 'admin')).text);
      texts.push((await get('/api/buildings')).text);
      texts.push((await get('/api/buildings/b-pub')).text);
      for (const text of texts) {
        assert.doesNotMatch(text, /acct_/);
        assert.equal(text.includes(stripeId), false);
      }
    });

    it('PATCH /companies/me no puede cambiar la cuenta guardada', async () => {
      await companyModel.update('c-a', {
        stripeAccountId: 'acct_a',
        stripeAccountStatus: 'active',
      });
      await call('PATCH', '/api/companies/me', {
        token: 'a',
        body: { contacto: 'Nuevo', stripeAccountId: 'acct_hack', stripeAccountStatus: 'active' },
      });
      const company = await companyModel.findById('c-a');
      assert.equal(company.stripeAccountId, 'acct_a');
    });

    it('doble clic y peticiones simultáneas: una sola cuenta guardada', async () => {
      const results = await Promise.all([
        post('/api/company/payouts/onboarding'),
        post('/api/company/payouts/onboarding'),
        post('/api/company/payouts/onboarding'),
      ]);
      for (const r of results) assert.ok([200, 409].includes(r.status), r.text);
      assert.ok(results.some((r) => r.status === 200));
      // Todas las llamadas a Stripe usaron la misma clave y hay una sola cuenta.
      assert.ok(
        new Set(stripe.calls.accountCreate.map((c) => c.options.idempotencyKey)).size === 1,
      );
      assert.equal(stripe.connected.size, 1);
      const [accountId] = [...stripe.connected.keys()];
      assert.equal((await companyModel.findById('c-a')).stripeAccountId, accountId);
    });

    it('con la clave de idempotencia en uso responde 409 PAYOUTS_BUSY y no guarda nada', async () => {
      stripe.accountKeyInUse = true;
      const res = await post('/api/company/payouts/onboarding');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_BUSY');
      assert.equal((await companyModel.findById('c-a')).stripeAccountId, undefined);
    });

    it('si la empresa ya tenía cuenta (otra petición ganó) la reutiliza y no pisa', async () => {
      await post('/api/company/payouts/onboarding');
      const first = (await companyModel.findById('c-a')).stripeAccountId;
      const res = await post('/api/company/payouts/onboarding');
      assert.equal(res.status, 200);
      assert.equal(stripe.calls.accountCreate.length, 1);
      assert.equal(stripe.calls.linkCreate.length, 2);
      assert.equal((await companyModel.findById('c-a')).stripeAccountId, first);
    });

    it('409 PAYOUTS_ALREADY_ACTIVE si la cuenta ya está activa', async () => {
      await post('/api/company/payouts/onboarding');
      const id = (await companyModel.findById('c-a')).stripeAccountId;
      stripe.connected.set(id, 'active');
      const res = await post('/api/company/payouts/onboarding');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_ALREADY_ACTIVE');
      assert.equal((await companyModel.findById('c-a')).stripeAccountStatus, 'active');
    });

    it('errores de Stripe: 502 sin detalle y 503 sin Stripe configurado', async () => {
      stripe.failAccountCreate = true;
      const bad = await post('/api/company/payouts/onboarding');
      assert.equal(bad.status, 502);
      assert.equal(bad.body.error.code, 'PAYMENTS_ERROR');
      assert.doesNotMatch(bad.text, /detalle-secreto/);
      stripe.failAccountCreate = false;
      stripe.failAccountLink = true;
      const link = await post('/api/company/payouts/onboarding');
      assert.equal(link.status, 502);
      assert.doesNotMatch(link.text, /detalle-secreto/);
      setStripeForTests(null);
      const none = await post('/api/company/payouts/onboarding');
      assert.equal(none.status, 503);
      assert.equal(none.body.error.code, 'PAYMENTS_UNAVAILABLE');
      setStripeForTests({ client: stripe, webhookSecret: SECRET });
    });

    it('429 al repetir las acciones más de lo permitido', async () => {
      setRateLimitForTests({ payouts: { limit: 1, windowMs: 60000 } });
      assert.equal((await post('/api/company/payouts/onboarding')).status, 200);
      assert.equal((await post('/api/company/payouts/onboarding')).status, 429);
      assert.equal((await post('/api/company/payouts/dashboard')).status, 429);
    });
  });

  describe('POST /api/company/payouts/dashboard', () => {
    it('409 PAYOUTS_REQUIRED sin cuenta', async () => {
      const res = await post('/api/company/payouts/dashboard');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_REQUIRED');
      assert.equal(stripe.calls.loginLink.length, 0);
    });

    it('devuelve el enlace de la cuenta de la propia empresa', async () => {
      await companyModel.update('c-a', { stripeAccountId: 'acct_a' });
      await companyModel.update('c-b', { stripeAccountId: 'acct_b' });
      const res = await post('/api/company/payouts/dashboard', 'a');
      assert.equal(res.status, 200);
      assert.deepEqual(Object.keys(res.body), ['url']);
      assert.deepEqual(stripe.calls.loginLink, ['acct_a']);
    });

    it('502 sin detalle si Stripe falla', async () => {
      await companyModel.update('c-a', { stripeAccountId: 'acct_a' });
      stripe.failLoginLink = true;
      const res = await post('/api/company/payouts/dashboard');
      assert.equal(res.status, 502);
      assert.doesNotMatch(res.text, /detalle-secreto/);
    });
  });

  describe('publicar una planta (POST /company/floors/:id/publish)', () => {
    const publish = (id, token = 'a') => post(`/api/company/floors/${id}/publish`, token);

    it('con salas de pago y sin cuenta: 409 PAYOUTS_REQUIRED y la planta sigue en borrador', async () => {
      await seedFloor('f1', [{ id: 'r1' }]);
      const res = await publish('f1');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_REQUIRED');
      assert.equal((await floorModel.findById('f1')).status, 'DRAFT');
    });

    it('con cuenta pendiente o restringida según Stripe: 409; con cuenta activa: 200', async () => {
      await seedFloor('f1', [{ id: 'r1' }]);
      await companyModel.update('c-a', {
        stripeAccountId: 'acct_a',
        stripeAccountStatus: 'active',
      });
      // Lo guardado dice activa, pero Stripe manda: no se fía del estado guardado.
      stripe.connected.set('acct_a', 'pending');
      assert.equal((await publish('f1')).body.error.code, 'PAYOUTS_REQUIRED');
      stripe.connected.set('acct_a', 'restricted');
      assert.equal((await publish('f1')).status, 409);
      assert.equal((await companyModel.findById('c-a')).stripeAccountStatus, 'restricted');
      stripe.connected.set('acct_a', 'active');
      const ok = await publish('f1');
      assert.equal(ok.status, 200);
      assert.equal((await floorModel.findById('f1')).status, 'PUBLISHED');
    });

    it('solo salas gratis: se publica sin cuenta y sin llamar a Stripe', async () => {
      await seedFloor('f-free', [{ id: 'rf1', extra: FREE }]);
      const res = await publish('f-free');
      assert.equal(res.status, 200);
      assert.equal(stripe.calls.accountRetrieve.length, 0);
    });

    it('una sala gratis y otra de pago: exige la cuenta', async () => {
      await seedFloor('f-mix', [{ id: 'rf1', extra: FREE }, { id: 'rp1' }]);
      assert.equal((await publish('f-mix')).body.error.code, 'PAYOUTS_REQUIRED');
    });

    it('una sala de pago oculta o sin precio no cuenta', async () => {
      await seedFloor('f-hid', [
        { id: 'rf1', extra: FREE },
        { id: 'rh1', extra: { bookable: false } },
      ]);
      assert.equal((await publish('f-hid')).status, 200);
    });

    it('Stripe caído con cuenta guardada: 503 y sigue en borrador (falla cerrado)', async () => {
      await seedFloor('f1', [{ id: 'r1' }]);
      await companyModel.update('c-a', {
        stripeAccountId: 'acct_a',
        stripeAccountStatus: 'active',
      });
      stripe.failAccountRetrieve = true;
      const res = await publish('f1');
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'PAYMENTS_UNAVAILABLE');
      assert.doesNotMatch(res.text, /detalle-secreto/);
      assert.equal((await floorModel.findById('f1')).status, 'DRAFT');
    });

    it('republicar una planta ya publicada sigue siendo idempotente aunque la cuenta cayera', async () => {
      await seedFloor('f1', [{ id: 'r1' }]);
      await companyModel.update('c-a', { stripeAccountId: 'acct_a' });
      assert.equal((await publish('f1')).status, 200);
      stripe.connected.set('acct_a', 'restricted');
      assert.equal((await publish('f1')).status, 200);
    });

    it('publicar el edificio no sirve de atajo: exige una planta publicada', async () => {
      await seedFloor('f1', [{ id: 'r1' }]);
      await buildingModel.create(
        { companyId: 'c-a', name: 'Ed', status: 'DRAFT', city: 'Sevilla' },
        { id: 'b-a' },
      );
      const res = await post('/api/company/buildings/b-a/publish');
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'NO_PUBLISHED_FLOORS');
    });
  });

  describe('crear una reserva de pago (POST /api/bookings)', () => {
    const reservar = (token = 'cliente') =>
      call('POST', '/api/bookings', {
        token,
        body: { roomId: 'r-free', fecha: FUT, inicio: 10, fin: 12 },
      });
    const slot = () => occupancyModel.findById(occupancyModel.slotId('r-free', FUT, 10));

    it('con la cuenta de la empresa activa: 201 pendiente de pago', async () => {
      const res = await reservar();
      assert.equal(res.status, 201);
      assert.equal(res.body.estado, 'PENDING_PAYMENT');
      assert.equal(stripe.calls.accountRetrieve.at(-1).id, 'acct_c1');
    });

    it('sin cuenta: 409 PAYOUTS_REQUIRED y no retiene horas', async () => {
      await companyModel.update('c1', { stripeAccountId: null });
      const res = await reservar();
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_REQUIRED');
      assert.equal(await slot(), null);
    });

    it('cuenta guardada como activa pero desactivada en Stripe: 409 y no retiene horas', async () => {
      stripe.connected.set('acct_c1', 'restricted');
      const res = await reservar();
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_REQUIRED');
      assert.equal(await slot(), null);
      assert.equal((await companyModel.findById('c1')).stripeAccountStatus, 'restricted');
    });

    it('Stripe caído: 503 PAYMENTS_UNAVAILABLE sin retener horas ni filtrar detalle', async () => {
      stripe.failAccountRetrieve = true;
      const res = await reservar();
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'PAYMENTS_UNAVAILABLE');
      assert.doesNotMatch(res.text, /detalle-secreto/);
      assert.equal(await slot(), null);
    });

    it('empresa suspendida: no se puede reservar', async () => {
      await companyModel.update('c1', { status: 'SUSPENDED', verified: false });
      const res = await reservar();
      assert.ok([404, 409].includes(res.status), res.text);
      assert.equal(await slot(), null);
    });

    it('una sala gratis no necesita cuenta ni consulta a Stripe', async () => {
      await companyModel.update('c1', { stripeAccountId: null });
      const base = await roomModel.findById('r-free');
      const { id, ...rest } = base;
      await roomModel.create(
        { ...rest, price: null, isFree: true, code: 'GRATIS' },
        { id: 'r-gratis' },
      );
      const res = await call('POST', '/api/bookings', {
        token: 'cliente',
        body: { roomId: 'r-gratis', fecha: FUT, inicio: 10, fin: 12 },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.estado, 'CONFIRMED');
      assert.equal(stripe.calls.accountRetrieve.length, 0);
      assert.ok(id);
    });
  });

  describe('crear la sesión de pago (POST /api/payments/checkout/:id)', () => {
    const checkout = (id, token = 'cliente') => post(`/api/payments/checkout/${id}`, token);

    it('el cobro va a la cuenta de la empresa (transfer_data) y se guarda el destino', async () => {
      await seedBooking('pk-1');
      const res = await checkout('pk-1');
      assert.equal(res.status, 200);
      const { params, options } = stripe.calls.create[0];
      assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_c1');
      assert.equal(params.metadata.destination, 'acct_c1');
      assert.equal('on_behalf_of' in params.payment_intent_data, false);
      assert.equal('application_fee_amount' in params.payment_intent_data, false);
      assert.equal(options.idempotencyKey, 'checkout:pk-1:1');
      assert.equal((await bookingModel.findById('pk-1')).checkoutDestination, 'acct_c1');
    });

    it('sin cuenta o con la cuenta desactivada: 409 PAYOUTS_REQUIRED y no se crea sesión', async () => {
      await seedBooking('pk-1');
      stripe.connected.set('acct_c1', 'restricted');
      const res = await checkout('pk-1');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_REQUIRED');
      assert.equal(stripe.calls.create.length, 0);
      assert.equal((await companyModel.findById('c1')).stripeAccountStatus, 'restricted');
      await companyModel.update('c1', { stripeAccountId: null });
      assert.equal((await checkout('pk-1')).body.error.code, 'PAYOUTS_REQUIRED');
    });

    it('empresa suspendida: 409 PAYOUTS_REQUIRED con mensaje claro', async () => {
      await seedBooking('pk-1');
      await companyModel.update('c1', { status: 'SUSPENDED', verified: false });
      const res = await checkout('pk-1');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PAYOUTS_REQUIRED');
      assert.match(res.body.error.message, /no puede cobrar/);
      assert.equal(stripe.calls.create.length, 0);
    });

    it('Stripe caído al comprobar la cuenta: 503 y no se crea sesión', async () => {
      await seedBooking('pk-1');
      stripe.failAccountRetrieve = true;
      const res = await checkout('pk-1');
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'PAYMENTS_UNAVAILABLE');
      assert.equal(stripe.calls.create.length, 0);
    });

    it('doble clic con el mismo destino reutiliza la sesión', async () => {
      await seedBooking('pk-1');
      const a = await checkout('pk-1');
      const b = await checkout('pk-1');
      assert.equal(a.body.sesionId, b.body.sesionId);
      assert.equal(stripe.calls.create.length, 1);
    });

    it('una reserva ajena sigue siendo 404 y no se llama a Stripe', async () => {
      await seedBooking('pk-1');
      const res = await checkout('pk-1', 'otro');
      assert.equal(res.status, 404);
      assert.equal(stripe.calls.accountRetrieve.length, 0);
    });

    it('si cambia el destino con una sesión abierta: intento nuevo y expira la anterior', async () => {
      await seedBooking('pk-1');
      const first = await checkout('pk-1');
      await companyModel.update('c1', { stripeAccountId: 'acct_nueva' });
      const second = await checkout('pk-1');
      assert.equal(second.status, 200);
      assert.notEqual(second.body.sesionId, first.body.sesionId);
      assert.deepEqual(stripe.calls.expire, [first.body.sesionId]);
      assert.equal(stripe.calls.create.length, 2);
      const { params, options } = stripe.calls.create[1];
      assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_nueva');
      assert.equal(options.idempotencyKey, 'checkout:pk-1:2');
      const booking = await bookingModel.findById('pk-1');
      assert.equal(booking.checkoutAttempt, 2);
      assert.equal(booking.checkoutDestination, 'acct_nueva');
    });

    it('una sesión anterior a Connect (sin destino) no se reutiliza', async () => {
      await seedBooking('pk-1', {
        checkoutAttempt: 1,
        checkoutExpiresAt: new Date(Date.now() + 25 * 60 * 1000),
        checkoutSessionId: 'cs_old',
      });
      stripe.sessions.set('cs_old', {
        id: 'cs_old',
        url: 'https://checkout.stripe.com/c/pay/cs_old',
        status: 'open',
        expires_at: Math.floor(Date.now() / 1000) + 1500,
      });
      const res = await checkout('pk-1');
      assert.equal(res.status, 200);
      assert.notEqual(res.body.sesionId, 'cs_old');
      assert.deepEqual(stripe.calls.expire, ['cs_old']);
      const { params, options } = stripe.calls.create[0];
      assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_c1');
      assert.equal(options.idempotencyKey, 'checkout:pk-1:2');
    });

    it('si no se puede expirar la sesión anterior, el pago sigue sin filtrar el detalle', async () => {
      await seedBooking('pk-1', {
        checkoutAttempt: 1,
        checkoutExpiresAt: new Date(Date.now() + 25 * 60 * 1000),
        checkoutSessionId: 'cs_old',
      });
      stripe.failExpire = true;
      const res = await checkout('pk-1');
      assert.equal(res.status, 200);
      assert.doesNotMatch(res.text, /detalle-secreto/);
    });
  });

  describe('el pago guardado por el webhook', () => {
    const paid = (bookingId, metadata = {}) => ({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_test_paid',
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: 5000,
          currency: 'eur',
          payment_intent: 'pi_test_1',
          livemode: false,
          mode: 'payment',
          client_reference_id: bookingId,
          metadata: { bookingId, attempt: '1', ...metadata },
        },
      },
    });

    it('guarda companyId de la reserva y la cuenta de destino verificada por la firma', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      const res = await webhook(paid('pk-1', { destination: 'acct_c1' }));
      assert.equal(res.status, 200);
      const payment = await paymentModel.findById('cs_test_paid');
      assert.equal(payment.companyId, 'c1');
      assert.equal(payment.destinationAccountId, 'acct_c1');
      assert.equal((await bookingModel.findById('pk-1')).status, 'CONFIRMED');
    });

    it('una sesión sin destino: se reembolsa, no se confirma y la reserva sigue pagable', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      const res = await webhook(paid('pk-1'));
      assert.equal(res.status, 200);
      const payment = await paymentModel.findById('cs_test_paid');
      assert.equal(payment.companyId, 'c1');
      assert.equal(payment.destinationAccountId, null);
      assert.equal(payment.refundReason, 'NO_DESTINATION');
      assert.equal(payment.status, 'REFUNDED');
      assert.equal('reverse_transfer' in stripe.calls.refunds[0].params, false);
      assert.equal((await bookingModel.findById('pk-1')).status, 'PENDING_PAYMENT');
      // Con una sesión nueva (intento 2, ya con destino) se puede pagar.
      const again = await post('/api/payments/checkout/pk-1', 'cliente');
      assert.equal(again.status, 200);
      assert.equal((await bookingModel.findById('pk-1')).checkoutAttempt, 2);
      const second = paid('pk-1', { destination: 'acct_c1', attempt: '2' });
      second.data.object.id = 'cs_test_paid2';
      assert.equal((await webhook(second)).status, 200);
      assert.equal((await bookingModel.findById('pk-1')).status, 'CONFIRMED');
    });

    it('un destino distinto al de la empresa: se reembolsa revirtiendo la transferencia real', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      await webhook(paid('pk-1', { destination: 'acct_otra' }));
      const payment = await paymentModel.findById('cs_test_paid');
      assert.equal(payment.refundReason, 'NO_DESTINATION');
      assert.equal(payment.destinationAccountId, 'acct_otra');
      assert.equal(payment.status, 'REFUNDED');
      assert.equal(stripe.calls.refunds[0].params.reverse_transfer, true);
      assert.equal((await bookingModel.findById('pk-1')).status, 'PENDING_PAYMENT');
    });

    it('el reintento del webhook no reembolsa dos veces', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      const event = paid('pk-1', { destination: 'acct_otra' });
      await webhook(event);
      await webhook(event);
      assert.equal(stripe.calls.refunds.length, 1);
      // Si el reembolso falla, el pago queda pendiente y el reintento de Stripe lo completa una vez.
      await seedBooking('pk-2', { checkoutAttempt: 1, claims: false });
      const event2 = paid('pk-2', { destination: 'acct_otra' });
      event2.data.object.id = 'cs_test_paid3';
      event2.data.object.payment_intent = 'pi_test_3';
      stripe.failRefund = true;
      assert.equal((await webhook(event2)).status, 500);
      let payment = await paymentModel.findById('cs_test_paid3');
      assert.equal(payment.refundPending, true);
      assert.notEqual(payment.status, 'REFUNDED');
      stripe.failRefund = false;
      assert.equal((await webhook(event2)).status, 200);
      payment = await paymentModel.findById('cs_test_paid3');
      assert.equal(payment.status, 'REFUNDED');
      const total = stripe.calls.refunds.length;
      assert.equal((await webhook(event2)).status, 200);
      assert.equal(stripe.calls.refunds.length, total);
    });

    it('empresa suspendida con la sesión abierta: no confirma, expira la reserva y revierte', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      await companyModel.update('c1', { status: 'SUSPENDED', verified: false });
      await webhook(paid('pk-1', { destination: 'acct_c1' }));
      const payment = await paymentModel.findById('cs_test_paid');
      assert.equal(payment.refundReason, 'COMPANY_NOT_APPROVED');
      assert.equal(payment.status, 'REFUNDED');
      assert.equal(stripe.calls.refunds[0].params.reverse_transfer, true);
      assert.equal((await bookingModel.findById('pk-1')).status, 'EXPIRED');
      assert.equal(await occupancyModel.findById(occupancyModel.slotId('r-free', FUT, 10)), null);
    });

    it('empresa suspendida y sesión sin destino: reembolso sin reverse_transfer', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      await companyModel.update('c1', { status: 'SUSPENDED', verified: false });
      await webhook(paid('pk-1'));
      const payment = await paymentModel.findById('cs_test_paid');
      assert.equal(payment.refundReason, 'COMPANY_NOT_APPROVED');
      assert.equal('reverse_transfer' in stripe.calls.refunds[0].params, false);
    });

    it('un destino que no parece una cuenta se ignora', async () => {
      await seedBooking('pk-1', { checkoutAttempt: 1 });
      await webhook(paid('pk-1', { destination: 'cualquier-cosa' }));
      assert.equal((await paymentModel.findById('cs_test_paid')).destinationAccountId, null);
    });

    it('un pago de una reserva que no existe queda con companyId null (y se reembolsa)', async () => {
      await webhook(paid('bk-fantasma', { destination: 'acct_c1' }));
      const payment = await paymentModel.findById('cs_test_paid');
      assert.equal(payment.companyId, null);
      assert.equal(payment.refundPending === true || payment.status === 'REFUNDED', true);
    });
  });

  describe('reembolsos (reverse_transfer)', () => {
    const refund = (id) => post(`/api/admin/payments/${id}/refund`, 'admin');

    it('un pago con destino revierte la transferencia', async () => {
      await seedPayment('cs-1', { destinationAccountId: 'acct_c1' });
      const res = await refund('cs-1');
      assert.equal(res.status, 200);
      assert.equal(stripe.calls.refunds.length, 1);
      assert.equal(stripe.calls.refunds[0].params.reverse_transfer, true);
      assert.equal((await paymentModel.findById('cs-1')).status, 'REFUNDED');
    });

    it('un pago antiguo (sin destino) se reembolsa como siempre, sin reverse_transfer', async () => {
      await seedPayment('cs-2', { legacy: true });
      const res = await refund('cs-2');
      assert.equal(res.status, 200);
      assert.equal('reverse_transfer' in stripe.calls.refunds[0].params, false);
      assert.equal((await paymentModel.findById('cs-2')).status, 'REFUNDED');
    });

    it('si falla la reversión el pago conserva el reembolso pendiente y se puede reintentar', async () => {
      await seedPayment('cs-3', { destinationAccountId: 'acct_c1' });
      stripe.failRefund = true;
      stripe.refundError = { type: 'StripeInvalidRequestError', code: 'balance_insufficient' };
      const res = await refund('cs-3');
      assert.ok(res.status >= 500, res.text);
      assert.doesNotMatch(res.text, /detalle-secreto/);
      const payment = await paymentModel.findById('cs-3');
      assert.equal(payment.refundPending, true);
      assert.equal(payment.status, 'SUCCEEDED');
      stripe.failRefund = false;
      assert.equal((await refund('cs-3')).status, 200);
      assert.equal(stripe.calls.refunds.at(-1).params.reverse_transfer, true);
    });
  });

  describe('GET /api/company/payouts/movements', () => {
    it('solo muestra los pagos de la empresa, sin datos del cliente ni ids de Stripe', async () => {
      await seedPayment('cs_test_a1', { destinationAccountId: 'acct_a' });
      await seedPayment('cs_test_a2', { refundPending: true });
      await seedPayment('cs_test_b1', { companyId: 'c-b' });
      await seedPayment('cs_test_old', { legacy: true });
      const res = await get('/api/company/payouts/movements', 'a');
      assert.equal(res.status, 200);
      assert.equal(res.body.movimientos.length, 2);
      assert.equal(res.body.total, 2);
      assert.equal(res.body.page, 1);
      assert.equal(res.body.limit, 20);
      assert.equal(res.body.truncado, false);
      for (const m of res.body.movimientos) {
        assert.deepEqual(Object.keys(m).sort(), [
          'codigoReserva',
          'estado',
          'fecha',
          'fechaReserva',
          'id',
          'importe',
          'moneda',
          'reembolsoPendiente',
          'sala',
        ]);
        assert.match(m.id, /^mov_[0-9a-f]+$/);
        assert.equal(m.importe, 50);
        assert.equal(m.moneda, 'EUR');
        assert.equal(m.sala, 'Sala r-free');
        assert.equal(m.fechaReserva, FUT);
      }
      assert.equal(res.body.movimientos.filter((m) => m.reembolsoPendiente).length, 1);
      assert.doesNotMatch(res.text, /cs_test|pi_|acct_|u-secreto|@/);
      const other = await get('/api/company/payouts/movements', 'b');
      assert.equal(other.body.movimientos.length, 1);
    });

    it('pagina de 20 en 20, de más reciente a más antigua', async () => {
      for (let i = 1; i <= 25; i++) {
        const id = `cs_p${String(i).padStart(2, '0')}`;
        await seedPayment(id);
        await paymentModel.update(id, { createdAt: new Date(2030, 0, 1, 0, i) });
      }
      const p1 = await get('/api/company/payouts/movements', 'a');
      assert.equal(p1.body.movimientos.length, 20);
      assert.equal(p1.body.total, 25);
      assert.equal(p1.body.movimientos[0].codigoReserva, 'IP-25');
      const p2 = await get('/api/company/payouts/movements?page=2', 'a');
      assert.equal(p2.body.movimientos.length, 5);
      assert.equal(p2.body.movimientos.at(-1).codigoReserva, 'IP-1');
      const ids = new Set([...p1.body.movimientos, ...p2.body.movimientos].map((m) => m.id));
      assert.equal(ids.size, 25);
      const p3 = await get('/api/company/payouts/movements?page=3', 'a');
      assert.deepEqual(p3.body.movimientos, []);
    });

    it('400 con página o parámetros no válidos', async () => {
      for (const q of [
        'page=0',
        'page=26',
        'page=abc',
        'page=1.5',
        'page=1&page=2',
        'page[]=1',
        'page[x]=1',
        'otro=1',
        'estado=SUCCEEDED',
      ]) {
        const res = await get(`/api/company/payouts/movements?${q}`, 'a');
        assert.equal(res.status, 400, q);
      }
    });
  });

  describe('script de relleno de companyId', () => {
    it('para escribir exige --project igual a FIREBASE_PROJECT_ID y no escribe si falta', async () => {
      await seedPayment('cs-old', { legacy: true, bookingId: 'bk-old' });
      const saved = process.env.FIREBASE_PROJECT_ID;
      try {
        delete process.env.FIREBASE_PROJECT_ID;
        await assert.rejects(
          () => backfillPaymentCompany({ confirm: true, project: 'x' }),
          /project/,
        );
        process.env.FIREBASE_PROJECT_ID = 'proyecto-test';
        await assert.rejects(() => backfillPaymentCompany({ confirm: true }), /project/);
        await assert.rejects(
          () => backfillPaymentCompany({ confirm: true, project: 'otro' }),
          /project/,
        );
        assert.equal((await paymentModel.findById('cs-old')).companyId, undefined);
        assert.equal((await backfillPaymentCompany()).dryRun, true);
      } finally {
        if (saved === undefined) delete process.env.FIREBASE_PROJECT_ID;
        else process.env.FIREBASE_PROJECT_ID = saved;
      }
    });

    it('sin confirmar solo informa; con confirmar rellena y es idempotente', async () => {
      process.env.FIREBASE_PROJECT_ID = 'proyecto-test';
      await seedPayment('cs-old', { legacy: true, bookingId: 'bk-old' });
      await seedPayment('cs-new', { companyId: 'c-b', destinationAccountId: 'acct_b' });
      await paymentModel.create(
        { bookingId: 'no-existe', status: 'SUCCEEDED', amount: 1 },
        { id: 'cs-huerfano' },
      );
      const dry = await backfillPaymentCompany();
      assert.equal(dry.dryRun, true);
      assert.equal(dry.actualizados, 1);
      assert.equal((await paymentModel.findById('cs-old')).companyId, undefined);
      const done = await backfillPaymentCompany({ confirm: true, project: 'proyecto-test' });
      assert.equal(done.actualizados, 1);
      assert.equal(done.sin_reserva, 1);
      assert.equal(done.ya_tenian, 1);
      const old = await paymentModel.findById('cs-old');
      assert.equal(old.companyId, 'c-a');
      assert.equal(old.destinationAccountId, undefined);
      assert.equal((await paymentModel.findById('cs-new')).companyId, 'c-b');
      assert.equal((await paymentModel.findById('cs-huerfano')).companyId, undefined);
      const again = await backfillPaymentCompany({ confirm: true, project: 'proyecto-test' });
      assert.equal(again.actualizados, 0);
    });

    it('se niega con NODE_ENV=production', async () => {
      process.env.FIREBASE_PROJECT_ID = 'proyecto-test';
      const saved = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await assert.rejects(
          () => backfillPaymentCompany({ confirm: true, project: 'proyecto-test' }),
          /production/,
        );
      } finally {
        process.env.NODE_ENV = saved;
      }
    });
  });
});
