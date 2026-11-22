// Test de integración de las salas gratis (DAT039): marcar gratis, mostrar, reservar, plano público,
// buscador y resumen de empresa, con el verificador de tokens y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { FECHA, getJson, listen, seedPublicData, seedSearchData } from '../helpers/publicData.js';

const tokens = {
  c1: { uid: 'u1', role: 'COMPANY', companyId: 'c1' },
  c2: { uid: 'u2', role: 'COMPANY', companyId: 'c2' },
  cliente: { uid: 'uc', role: 'CLIENT' },
};

describe('Salas gratis', () => {
  let server;
  let baseUrl;

  async function call(method, path, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }
  const patch = (id, body, token = 'c1') =>
    call('PATCH', `/api/company/rooms/${id}`, { token, body });
  const visibility = (id, visible, token = 'c1') =>
    call('PATCH', `/api/company/rooms/${id}/visibility`, { token, body: { visible } });

  // Añade a f-0 una sala del mapa con su documento (por defecto sin precio).
  async function addRoom(id, extra) {
    const f0 = await floorModel.findById('f-0');
    const sala = { id, codigo: id, nombre: id, tipo: 'sala', x: 900, y: 0, w: 50, h: 50 };
    await floorModel.update('f-0', { salas: [...f0.salas, sala] });
    await roomModel.upsert(id, {
      companyId: 'c1',
      buildingId: 'b-pub',
      floorId: 'f-0',
      name: id,
      code: id,
      type: 'sala',
      capacity: 5,
      price: null,
      pricePeriod: 'HOUR',
      bookable: true,
      status: 'ACTIVE',
      ...extra,
    });
  }

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await seedPublicData();
    await companyModel.upsert('c2', { name: 'Empresa c2', status: 'APPROVED', verified: true });
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('PATCH /api/company/rooms/:id', () => {
    it('gratis: true (200): gratis y sin precio', async () => {
      const r = await patch('r-free', { gratis: true });
      assert.equal(r.status, 200);
      assert.equal(r.body.gratis, true);
      assert.equal(r.body.precioHora, null);
      const doc = await roomModel.findById('r-free');
      assert.equal(doc.isFree, true);
      assert.equal(doc.price, null);
    });

    it('gratis: true con precioHora: 400 VALIDATION_ERROR en gratis', async () => {
      const r = await patch('r-free', { gratis: true, precioHora: 10 });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      assert.ok(JSON.stringify(r.body.error.details).includes('gratis'));
      assert.equal((await roomModel.findById('r-free')).price, 25);
    });

    it('gratis no booleano ("true", 1, [true], "si"): 400', async () => {
      for (const gratis of ['true', 1, [true], 'si']) {
        assert.equal((await patch('r-free', { gratis })).status, 400, JSON.stringify(gratis));
      }
      assert.equal((await roomModel.findById('r-free')).price, 25);
    });

    it('un precio en una sala gratis la desmarca', async () => {
      await patch('r-free', { gratis: true });
      const r = await patch('r-free', { precioHora: 30 });
      assert.equal(r.status, 200);
      assert.equal(r.body.gratis, false);
      assert.equal(r.body.precioHora, 30);
      assert.equal((await roomModel.findById('r-free')).isFree, false);
    });

    it('gratis: false sin precio la deja sin_precio', async () => {
      await addRoom('r-g', { isFree: true, bookable: false });
      assert.equal((await patch('r-g', { gratis: false })).status, 200);
      const list = await call('GET', '/api/company/rooms', { token: 'c1' });
      const room = (list.body.salas ?? list.body).find((s) => s.id === 'r-g');
      assert.equal(room.estado, 'sin_precio');
      assert.equal(room.gratis, false);
    });

    it('404 con sala ajena y 403 con rol cliente', async () => {
      assert.equal((await patch('r-free', { gratis: true }, 'c2')).status, 404);
      assert.equal((await patch('r-free', { gratis: true }, 'cliente')).status, 403);
      assert.equal((await roomModel.findById('r-free')).price, 25);
    });
  });

  describe('visibilidad', () => {
    it('mostrar sin precio ni gratis: 400 ROOM_WITHOUT_PRICE', async () => {
      await addRoom('r-n', { bookable: false });
      const r = await visibility('r-n', true);
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'ROOM_WITHOUT_PRICE');
    });

    it('mostrar una sala gratis: 200 publicada', async () => {
      await addRoom('r-g', { isFree: true, bookable: false });
      const r = await visibility('r-g', true);
      assert.equal(r.status, 200);
      assert.equal(r.body.estado, 'publicada');
      assert.equal(r.body.gratis, true);
    });
  });

  describe('reservas', () => {
    const reservar = (roomId) =>
      call('POST', '/api/bookings', {
        token: 'cliente',
        body: { roomId, fecha: '2030-03-12', inicio: 10, fin: 12 },
      });

    it('reservar una sala gratis: 201 con importe 0 y precioHora 0', async () => {
      await addRoom('r-g', { isFree: true });
      const r = await reservar('r-g');
      assert.equal(r.status, 201);
      assert.equal(r.body.precioHora, 0);
      assert.equal(r.body.importe, 0);
    });

    it('una sala sin precio ni gratis sigue sin poder reservarse', async () => {
      await addRoom('r-n');
      assert.equal((await reservar('r-n')).status, 400);
    });
  });

  describe('API pública', () => {
    it('plano: sala gratis FREE con gratis: true; las demás gratis: false', async () => {
      await addRoom('r-g', { isFree: true });
      const { body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
      const g = body.salas.find((s) => s.id === 'r-g');
      assert.equal(g.estado, 'FREE');
      assert.equal(g.gratis, true);
      assert.equal(g.precioHora, 0);
      assert.equal(body.salas.find((s) => s.id === 'r-free').gratis, false);
      assert.equal(body.salas.find((s) => s.id === 'r-nobook').gratis, false);
    });

    it('ficha: gratis true y precioHora 0', async () => {
      await addRoom('r-g', { isFree: true });
      const { status, body } = await getJson(baseUrl, '/api/rooms/r-g');
      assert.equal(status, 200);
      assert.equal(body.gratis, true);
      assert.equal(body.precioHora, 0);
      assert.equal((await getJson(baseUrl, '/api/rooms/r-free')).body.gratis, false);
    });

    it('buscador: precioDesde 0, entra con precioMax=1 y ordena por precio', async () => {
      await seedSearchData();
      await roomModel.upsert('r-mal-gratis', {
        companyId: 'c1',
        buildingId: 'b-mal',
        floorId: 'f-mal',
        name: 'Gratis',
        code: 'G',
        type: 'sala',
        capacity: 5,
        price: null,
        isFree: true,
        pricePeriod: 'HOUR',
        bookable: true,
        status: 'ACTIVE',
      });
      const all = await getJson(baseUrl, '/api/buildings?orden=precio');
      assert.equal(all.body.edificios[0].id, 'b-mal');
      assert.equal(all.body.edificios[0].precioDesde, 0);
      const cheap = await getJson(baseUrl, '/api/buildings?precioMax=1');
      assert.deepEqual(
        cheap.body.edificios.map((b) => b.id),
        ['b-mal'],
      );
    });
  });

  describe('panel de empresa', () => {
    it('GET /company/rooms incluye gratis en cada sala', async () => {
      await addRoom('r-g', { isFree: true });
      const r = await call('GET', '/api/company/rooms', { token: 'c1' });
      const list = r.body.salas ?? r.body;
      assert.ok(list.every((s) => typeof s.gratis === 'boolean'));
      assert.equal(list.find((s) => s.id === 'r-g').gratis, true);
      assert.equal(list.find((s) => s.id === 'r-g').estado, 'publicada');
    });

    it('el resumen no cuenta una sala gratis como sin precio', async () => {
      await addRoom('r-g', { isFree: true });
      await addRoom('r-n');
      const r = await call('GET', '/api/company/summary', { token: 'c1' });
      const ids = r.body.tareas.salasSinPrecio.map((s) => s.id);
      assert.ok(ids.includes('r-n'));
      assert.ok(!ids.includes('r-g'));
    });

    it('publicar una planta solo con salas gratis: 200', async () => {
      const sala = {
        id: 'r-solo',
        codigo: 'S',
        nombre: 'S',
        tipo: 'sala',
        x: 0,
        y: 0,
        w: 50,
        h: 50,
      };
      await floorModel.upsert('f-solo', {
        companyId: 'c1',
        buildingId: 'b-pub',
        name: 'Solo gratis',
        level: 5,
        status: 'DRAFT',
        ancho: 1000,
        alto: 600,
        salas: [sala],
      });
      await roomModel.upsert('r-solo', {
        companyId: 'c1',
        buildingId: 'b-pub',
        floorId: 'f-solo',
        name: 'S',
        code: 'S',
        isFree: true,
        price: null,
        bookable: true,
        status: 'ACTIVE',
      });
      const r = await call('POST', '/api/company/floors/f-solo/publish', { token: 'c1' });
      assert.equal(r.status, 200);
      assert.equal(r.body.publicado, true);
    });
  });
});
