// Test de integración: POST /api/bookings, GET /api/bookings/me y PATCH /api/bookings/:id/cancel (con token).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setStripeForTests } from '../../src/config/stripe.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { createStripeDouble } from '../helpers/stripeDouble.js';
import { listen, seedPublicData } from '../helpers/publicData.js';

// Fecha futura fija y lejana para no depender del día en que se ejecuta el test.
const FUTURA = '2030-03-12';
const AYER = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

describe('Reservas del cliente', () => {
  let server;
  let baseUrl;
  let stripe;

  // Petición con token: el doble acepta el token como uid ("u1", "u2"...).
  async function request(method, path, { token = 'u1', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  }

  const reservar = (body, token) => request('POST', '/api/bookings', { token, body });
  const franja = (inicio, fin, extra = {}) => ({
    roomId: 'r-free',
    fecha: FUTURA,
    inicio,
    fin,
    ...extra,
  });

  before(async () => {
    setTokenVerifier(async (token) => ({ uid: token }));
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    stripe = createStripeDouble();
    setStripeForTests({ client: stripe, webhookSecret: 'whsec_test' });
    setTokenVerifier(async (token) => ({ uid: token }));
    setDbForTests(createFakeFirestore());
    await seedPublicData();
  });

  after(async () => {
    setStripeForTests(null);
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('POST /api/bookings', () => {
    it('crea la reserva con el importe calculado en el servidor', async () => {
      // Actuar
      const { status, body } = await reservar(franja(10, 13));
      // Comprobar
      assert.equal(status, 201);
      assert.equal(body.roomId, 'r-free');
      assert.equal(body.fecha, FUTURA);
      assert.equal(body.horas, 3);
      assert.equal(body.precioHora, 25);
      assert.equal(body.importe, 75);
      assert.equal(body.estado, 'PENDING_PAYMENT');
      assert.ok(Date.parse(body.expiraEn) > Date.now(), 'lleva expiraEn');
      const guardada = await bookingModel.findById(body.id);
      assert.equal(guardada.userId, 'u1');
      assert.equal(guardada.companyId, 'c1');
      assert.equal(guardada.totalAmount, 75);
    });

    it('una sala gratis (0 €) nace CONFIRMED, sin expiraEn, sin sesión ni pago y sin Stripe', async () => {
      await roomModel.update('r-free', { isFree: true, price: null });
      setStripeForTests(null);
      const { status, body } = await reservar(franja(10, 12));
      assert.equal(status, 201);
      assert.equal(body.estado, 'CONFIRMED');
      assert.equal(body.importe, 0);
      assert.equal(body.expiraEn, undefined);
      assert.equal((await bookingModel.findById(body.id)).paymentId, null);
      assert.equal(stripe.calls.create.length, 0);
      // Cancelarla no toca Stripe ni genera reembolso.
      const cancel = await request('PATCH', `/api/bookings/${body.id}/cancel`);
      assert.deepEqual(cancel.body, { id: body.id, estado: 'CANCELLED' });
      assert.equal(stripe.calls.refunds.length, 0);
    });

    it('503 PAYMENTS_UNAVAILABLE sin Stripe y no retiene horas ni gasta código', async () => {
      setStripeForTests(null);
      const { status, body } = await reservar(franja(10, 12));
      assert.equal(status, 503);
      assert.equal(body.error.code, 'PAYMENTS_UNAVAILABLE');
      assert.deepEqual(await occupancyModel.listByRoomAndDate('r-free', FUTURA), []);
      assert.deepEqual(await bookingModel.listByUser('u1'), []);
      setStripeForTests({ client: stripe, webhookSecret: 'whsec_test' });
      assert.equal((await reservar(franja(10, 12))).body.codigo, 'IP-1000');
    });

    it('crea una ficha de occupancy por hora sin datos del cliente', async () => {
      // Actuar
      const { body } = await reservar(franja(10, 13));
      // Comprobar
      const fichas = await occupancyModel.listByRoomAndDate('r-free', FUTURA);
      assert.deepEqual(
        fichas.map((f) => f.hour).sort((a, b) => a - b),
        [10, 11, 12],
      );
      for (const ficha of fichas) {
        assert.equal(ficha.id, `r-free_${FUTURA}_${String(ficha.hour).padStart(2, '0')}`);
        assert.equal(ficha.bookingId, body.id);
        assert.equal(ficha.companyId, 'c1');
        assert.equal(ficha.userId, undefined);
        assert.equal(ficha.email, undefined);
        assert.equal(ficha.totalAmount, undefined);
        assert.equal(ficha.importe, undefined);
      }
    });

    it('ignora importe, estado y userId enviados en el body', async () => {
      // Actuar
      const { status, body } = await reservar(
        franja(10, 12, {
          importe: 0,
          totalAmount: 0,
          price: 0,
          estado: 'CANCELLED',
          status: 'CANCELLED',
          userId: 'otro',
        }),
      );
      // Comprobar
      assert.equal(status, 201);
      assert.equal(body.importe, 50);
      assert.equal(body.estado, 'PENDING_PAYMENT');
      const guardada = await bookingModel.findById(body.id);
      assert.equal(guardada.userId, 'u1');
      assert.equal(guardada.status, 'PENDING_PAYMENT');
      assert.equal(guardada.totalAmount, 50);
      assert.equal(guardada.price, 25);
    });

    it('responde 409 SLOT_TAKEN si la franja se solapa con otra reserva', async () => {
      // Preparar
      await reservar(franja(10, 12));
      // Actuar
      const { status, body } = await reservar(franja(11, 13), 'u2');
      // Comprobar
      assert.equal(status, 409);
      assert.equal(body.error.code, 'SLOT_TAKEN');
    });

    it('permite franjas contiguas', async () => {
      // Preparar
      await reservar(franja(10, 12));
      // Actuar
      const despues = await reservar(franja(12, 14), 'u2');
      const antes = await reservar(franja(8, 10), 'u2');
      // Comprobar
      assert.equal(despues.status, 201);
      assert.equal(antes.status, 201);
    });

    it('responde 400 OUT_OF_HOURS fuera del horario 8-20', async () => {
      const { status, body } = await reservar(franja(7, 9));
      assert.equal(status, 400);
      assert.equal(body.error.code, 'OUT_OF_HOURS');
      const tarde = await reservar(franja(19, 21));
      assert.equal(tarde.body.error.code, 'OUT_OF_HOURS');
    });

    it('responde 400 ROOM_NOT_BOOKABLE si la sala no es reservable', async () => {
      const { status, body } = await reservar(franja(10, 12, { roomId: 'r-nobook' }));
      assert.equal(status, 400);
      assert.equal(body.error.code, 'ROOM_NOT_BOOKABLE');
    });

    for (const [titulo, id] of [
      ['inexistente', 'no-existe'],
      ['INACTIVE', 'r-inactive'],
      ['de una planta DRAFT', 'r-draftfloor'],
      ['de un edificio DRAFT', 'r-in-draft'],
    ]) {
      it(`responde 404 si la sala es ${titulo}`, async () => {
        const { status, body } = await reservar(franja(10, 12, { roomId: id }));
        assert.equal(status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
      });
    }

    for (const [titulo, datos] of [
      ['fecha pasada', { fecha: AYER }],
      ['fecha mal formada', { fecha: '15/06/2030' }],
      ['fecha inexistente', { fecha: '2030-02-31' }],
      ['inicio igual que fin', { inicio: 10, fin: 10 }],
      ['inicio mayor que fin', { inicio: 12, fin: 10 }],
      ['hora 25', { inicio: 10, fin: 25 }],
      ['inicio negativo', { inicio: -1, fin: 10 }],
      ['sin roomId', { roomId: undefined }],
    ]) {
      it(`responde 400 VALIDATION_ERROR con ${titulo}`, async () => {
        const { status, body } = await reservar(franja(10, 12, datos));
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      });
    }

    it('responde 401 sin token', async () => {
      const { status, body } = await reservar(franja(10, 12), null);
      assert.equal(status, 401);
      assert.equal(body.error.code, 'NO_TOKEN');
    });
  });

  describe('solo clientes: crear y listar', () => {
    it('responde 403 FORBIDDEN a empresa y admin al crear y al listar, sin crear nada', async () => {
      setTokenVerifier(async (token) => ({ uid: 'u1', role: token }));
      for (const role of ['COMPANY', 'ADMIN']) {
        const crear = await reservar(franja(10, 12), role);
        assert.equal(crear.status, 403);
        assert.equal(crear.body.error.code, 'FORBIDDEN');
        const listar = await request('GET', '/api/bookings/me', { token: role });
        assert.equal(listar.status, 403);
        assert.equal(listar.body.error.code, 'FORBIDDEN');
      }
      assert.deepEqual(await occupancyModel.listByRoomAndDate('r-free', FUTURA), []);
    });
  });

  describe('GET /api/bookings/me', () => {
    it('separa próximas y pasadas y solo devuelve las del usuario', async () => {
      // Preparar
      await reservar(franja(10, 12));
      await reservar(franja(14, 15), 'u2');
      await bookingModel.upsert('bk-pasada', {
        userId: 'u1',
        companyId: 'c1',
        roomId: 'r-free',
        startDate: new Date(2020, 0, 10, 9),
        endDate: new Date(2020, 0, 10, 11),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status: 'CONFIRMED',
      });
      // Actuar
      const { status, body } = await request('GET', '/api/bookings/me');
      // Comprobar
      assert.equal(status, 200);
      assert.equal(body.proximas.length, 1);
      assert.equal(body.proximas[0].fecha, FUTURA);
      assert.equal(body.proximas[0].inicio, 10);
      assert.equal(body.pasadas.length, 1);
      assert.equal(body.pasadas[0].id, 'bk-pasada');
      assert.equal(body.pasadas[0].fecha, '2020-01-10');
    });

    it('una reserva futura cancelada va a pasadas, no a próximas', async () => {
      // Preparar
      await bookingModel.upsert('bk-cancelada', {
        userId: 'u1',
        companyId: 'c1',
        roomId: 'r-free',
        startDate: new Date(2099, 0, 10, 9),
        endDate: new Date(2099, 0, 10, 11),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status: 'CANCELLED',
      });
      // Actuar
      const { status, body } = await request('GET', '/api/bookings/me');
      // Comprobar
      assert.equal(status, 200);
      assert.equal(body.proximas.length, 0);
      assert.deepEqual(
        body.pasadas.map((b) => [b.id, b.estado]),
        [['bk-cancelada', 'CANCELLED']],
      );
    });

    it('devuelve listas vacías si el usuario no tiene reservas', async () => {
      const { status, body } = await request('GET', '/api/bookings/me', { token: 'nuevo' });
      assert.equal(status, 200);
      assert.deepEqual(body, { proximas: [], pasadas: [] });
    });

    it('responde 401 sin token', async () => {
      const { status, body } = await request('GET', '/api/bookings/me', { token: null });
      assert.equal(status, 401);
      assert.equal(body.error.code, 'NO_TOKEN');
    });
  });

  describe('código legible y GET /api/bookings/:id', () => {
    const detalle = (id, token) => request('GET', `/api/bookings/${id}`, { token });

    it('crea códigos IP-n secuenciales desde 1000 y los guarda', async () => {
      const a = await reservar(franja(10, 12));
      const b = await reservar(franja(14, 15), 'u2');
      assert.match(a.body.codigo, /^IP-\d{4,}$/);
      assert.equal(a.body.codigo, 'IP-1000');
      assert.equal(b.body.codigo, 'IP-1001');
      assert.equal((await bookingModel.findById(a.body.id)).code, 'IP-1000');
    });

    it('no gasta código si la reserva falla por franja ocupada', async () => {
      await reservar(franja(10, 12));
      assert.equal((await reservar(franja(11, 13), 'u2')).status, 409);
      assert.equal((await reservar(franja(14, 15), 'u2')).body.codigo, 'IP-1001');
    });

    it('devuelve el detalle de la reserva propia sin datos privados', async () => {
      const { body: creada } = await reservar(franja(10, 13));
      const { status, body } = await request('GET', `/api/bookings/${creada.id}`);
      const text = JSON.stringify(body);
      assert.equal(status, 200);
      assert.equal(body.id, creada.id);
      assert.equal(body.codigo, 'IP-1000');
      assert.equal(body.fecha, FUTURA);
      assert.equal(body.inicio, 10);
      assert.equal(body.fin, 13);
      assert.equal(body.horas, 3);
      assert.equal(body.importe, 75);
      assert.equal(body.estado, 'PENDING_PAYMENT');
      assert.deepEqual(body.sala, { id: 'r-free', codigo: 'R-FREE', nombre: 'Sala r-free' });
      assert.deepEqual(body.planta, { id: 'f-0', nombre: 'Planta baja', nivel: 0 });
      assert.deepEqual(body.edificio, {
        id: 'b-pub',
        nombre: 'Edificio publicado',
        direccion: 'Calle Ficticia 1',
        ciudad: 'Sevilla',
      });
      assert.equal(body.canceladaPor, undefined);
      for (const word of ['userId', 'companyId', 'u1', 'c1', 'email']) {
        assert.ok(!text.includes(word), `no debe incluir ${word}`);
      }
    });

    it('responde 404 NOT_FOUND igual con una reserva ajena y con una inexistente', async () => {
      const { body: creada } = await reservar(franja(10, 12));
      const ajena = await detalle(creada.id, 'u2');
      const falta = await detalle('no-existe');
      assert.equal(ajena.status, 404);
      assert.equal(ajena.body.error.code, 'NOT_FOUND');
      assert.deepEqual(ajena.body, falta.body);
      assert.equal(falta.status, 404);
    });

    it('responde 403 a empresa y admin, 401 sin token y 400 con un id inválido', async () => {
      const { body: creada } = await reservar(franja(10, 12));
      setTokenVerifier(async (token) => ({ uid: 'u1', role: token }));
      assert.equal((await detalle(creada.id, 'COMPANY')).status, 403);
      assert.equal((await detalle(creada.id, 'ADMIN')).status, 403);
      assert.equal((await detalle(creada.id, 'CLIENT')).status, 200);
      setTokenVerifier(async (token) => ({ uid: token }));
      const sin = await detalle(creada.id, null);
      assert.equal(sin.status, 401);
      assert.equal(sin.body.error.code, 'NO_TOKEN');
      assert.equal((await detalle('a.b')).status, 400);
    });

    it('/bookings/me no lo captura /:id', async () => {
      const { status, body } = await request('GET', '/api/bookings/me');
      assert.equal(status, 200);
      assert.deepEqual(body, { proximas: [], pasadas: [] });
    });

    it('la cancelada por el cliente indica canceladaPor cliente', async () => {
      const { body: creada } = await reservar(franja(10, 12));
      await request('PATCH', `/api/bookings/${creada.id}/cancel`);
      const { body } = await detalle(creada.id);
      assert.equal(body.estado, 'CANCELLED');
      assert.equal(body.canceladaPor, 'cliente');
      assert.equal(body.motivoCancelacion, null);
      assert.equal((await bookingModel.findById(creada.id)).cancelledBy, 'CLIENT');
    });

    it('sigue viéndose si la sala ya no existe', async () => {
      await bookingModel.upsert('bk-huerfana', {
        userId: 'u1',
        companyId: 'c1',
        roomId: 'borrada',
        startDate: new Date(2030, 0, 10, 9),
        endDate: new Date(2030, 0, 10, 11),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status: 'CONFIRMED',
      });
      const { status, body } = await detalle('bk-huerfana');
      assert.equal(status, 200);
      assert.equal(body.sala, null);
      assert.equal(body.planta, null);
      assert.equal(body.edificio, null);
      assert.equal(body.codigo, null);
    });
  });

  describe('PATCH /api/bookings/:id/cancel', () => {
    it('cancela la reserva propia y libera la franja', async () => {
      // Preparar
      const { body: creada } = await reservar(franja(10, 12));
      // Actuar
      const { status, body } = await request('PATCH', `/api/bookings/${creada.id}/cancel`);
      // Comprobar
      assert.equal(status, 200);
      assert.deepEqual(body, { id: creada.id, estado: 'CANCELLED' });
      assert.equal((await bookingModel.findById(creada.id)).status, 'CANCELLED');
      assert.deepEqual(await occupancyModel.listByRoomAndDate('r-free', FUTURA), []);
      const otra = await reservar(franja(10, 12), 'u2');
      assert.equal(otra.status, 201);
    });

    it('responde 404 NOT_FOUND (como una inexistente) si la reserva es de otro usuario', async () => {
      const { body: creada } = await reservar(franja(10, 12));
      const { status, body } = await request('PATCH', `/api/bookings/${creada.id}/cancel`, {
        token: 'u2',
      });
      const falta = await request('PATCH', '/api/bookings/no-existe/cancel');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.deepEqual(body, falta.body);
      assert.equal((await bookingModel.findById(creada.id)).status, 'PENDING_PAYMENT');
    });

    it('responde 403 FORBIDDEN a empresa y admin al cancelar', async () => {
      const { body: creada } = await reservar(franja(10, 12));
      setTokenVerifier(async (token) => ({ uid: 'u1', role: token }));
      for (const role of ['COMPANY', 'ADMIN']) {
        const { status, body } = await request('PATCH', `/api/bookings/${creada.id}/cancel`, {
          token: role,
        });
        assert.equal(status, 403);
        assert.equal(body.error.code, 'FORBIDDEN');
      }
      assert.equal((await bookingModel.findById(creada.id)).status, 'PENDING_PAYMENT');
    });

    it('responde 400 BOOKING_STARTED si la reserva ya ha empezado', async () => {
      // Preparar
      await bookingModel.upsert('bk-pasada', {
        userId: 'u1',
        companyId: 'c1',
        roomId: 'r-free',
        startDate: new Date(2020, 0, 10, 9),
        endDate: new Date(2020, 0, 10, 11),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status: 'CONFIRMED',
      });
      // Actuar
      const { status, body } = await request('PATCH', '/api/bookings/bk-pasada/cancel');
      // Comprobar
      assert.equal(status, 400);
      assert.equal(body.error.code, 'BOOKING_STARTED');
    });

    it('responde 404 si la reserva no existe', async () => {
      const { status, body } = await request('PATCH', '/api/bookings/no-existe/cancel');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('responde 401 sin token', async () => {
      const { status, body } = await request('PATCH', '/api/bookings/bk-1/cancel', {
        token: null,
      });
      assert.equal(status, 401);
      assert.equal(body.error.code, 'NO_TOKEN');
    });
  });
});
