// Test de integración: POST /api/bookings, GET /api/bookings/me y PATCH /api/bookings/:id/cancel (con token).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
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
    setDbForTests(createFakeFirestore());
    await seedPublicData();
  });

  after(async () => {
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
      assert.equal(body.estado, 'CONFIRMED');
      const guardada = await bookingModel.findById(body.id);
      assert.equal(guardada.userId, 'u1');
      assert.equal(guardada.companyId, 'c1');
      assert.equal(guardada.totalAmount, 75);
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
      assert.equal(body.estado, 'CONFIRMED');
      const guardada = await bookingModel.findById(body.id);
      assert.equal(guardada.userId, 'u1');
      assert.equal(guardada.status, 'CONFIRMED');
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

    it('responde 403 FORBIDDEN si la reserva es de otro usuario', async () => {
      const { body: creada } = await reservar(franja(10, 12));
      const { status, body } = await request('PATCH', `/api/bookings/${creada.id}/cancel`, {
        token: 'u2',
      });
      assert.equal(status, 403);
      assert.equal(body.error.code, 'FORBIDDEN');
      assert.equal((await bookingModel.findById(creada.id)).status, 'CONFIRMED');
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
