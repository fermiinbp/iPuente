// Test de integración: publicar edificios y gestionar salas del panel de empresa,
// con el verificador de tokens y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  b: { uid: 'ub', role: 'COMPANY', companyId: 'c-b' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  cliente: { uid: 'uc', role: 'CLIENT' },
};

describe('Publicar edificios y gestionar salas', () => {
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

  const mkFloor = (id, companyId, buildingId, level, status) =>
    floorModel.create(
      {
        companyId,
        buildingId,
        name: `P${level}`,
        level,
        status,
        ancho: 1000,
        alto: 600,
        salas: [],
      },
      { id },
    );
  const mkRoom = (id, companyId, buildingId, floorId, extra = {}) =>
    roomModel.create(
      {
        companyId,
        buildingId,
        floorId,
        name: `Sala ${id}`,
        code: id.toUpperCase(),
        status: 'ACTIVE',
        ...extra,
      },
      { id },
    );
  const buildingStatus = async (id) => (await buildingModel.findById(id)).status;
  const floorStatus = async (id) => (await floorModel.findById(id)).status;

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await companyModel.create({ name: 'A', status: 'APPROVED', verified: true }, { id: 'c-a' });
    await companyModel.create({ name: 'B', status: 'APPROVED', verified: true }, { id: 'c-b' });
    await companyModel.create({ name: 'P', status: 'PENDING', verified: false }, { id: 'c-pend' });
    const b = (companyId, name) => ({
      companyId,
      name,
      address: 'Calle 1',
      city: 'Sevilla',
      status: 'DRAFT',
    });
    await buildingModel.create(b('c-a', 'Edif A'), { id: 'b-a' }); // con planta publicada
    await buildingModel.create(b('c-a', 'Edif A2'), { id: 'b-a2' }); // solo borradores
    await buildingModel.create(b('c-b', 'Edif B'), { id: 'b-b' });
    await mkFloor('f-a1', 'c-a', 'b-a', 1, 'PUBLISHED');
    await mkFloor('f-a0', 'c-a', 'b-a', 0, 'DRAFT');
    await mkFloor('f-a2', 'c-a', 'b-a2', 0, 'DRAFT');
    await mkFloor('f-b', 'c-b', 'b-b', 0, 'PUBLISHED');
    await mkRoom('r-pub', 'c-a', 'b-a', 'f-a1', { price: 10, bookable: true });
    await mkRoom('r-oculta', 'c-a', 'b-a', 'f-a1', { price: 10, bookable: false });
    await mkRoom('r-sinprecio', 'c-a', 'b-a', 'f-a0', { bookable: false });
    await mkRoom('r-cero', 'c-a', 'b-a', 'f-a0', { price: 0, bookable: true });
    await mkRoom('r-inactiva', 'c-a', 'b-a', 'f-a0', { price: 10, status: 'INACTIVE' });
    await mkRoom('r-b', 'c-b', 'b-b', 'f-b', { price: 5, bookable: true });
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('permisos', () => {
    const endpoints = [
      ['POST', '/api/company/buildings/b-a/publish'],
      ['POST', '/api/company/buildings/b-a/unpublish'],
      ['POST', '/api/company/floors/f-a1/unpublish'],
      ['GET', '/api/company/rooms'],
      ['PATCH', '/api/company/rooms/r-pub/visibility', { visible: false }],
    ];
    for (const [method, path, body] of endpoints) {
      it(`${method} ${path}: 401 sin token`, async () => {
        assert.equal((await call(method, path, { body })).status, 401);
      });
      it(`${method} ${path}: 403 FORBIDDEN con rol CLIENT`, async () => {
        const r = await call(method, path, { token: 'cliente', body });
        assert.equal(r.status, 403);
        assert.equal(r.body.error.code, 'FORBIDDEN');
      });
      it(`${method} ${path}: 403 COMPANY_NOT_APPROVED con empresa pendiente`, async () => {
        const r = await call(method, path, { token: 'pend', body });
        assert.equal(r.status, 403);
        assert.equal(r.body.error.code, 'COMPANY_NOT_APPROVED');
      });
    }
  });

  describe('POST /company/buildings/:id/publish', () => {
    it('publica con una planta publicada (200) y es idempotente', async () => {
      const r = await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(r.body.publicado, true);
      assert.equal(await buildingStatus('b-a'), 'PUBLISHED');
      const again = await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      assert.equal(again.status, 200);
      assert.equal(again.body.publicado, true);
    });

    it('sin plantas publicadas: 400 NO_PUBLISHED_FLOORS y sigue DRAFT', async () => {
      const r = await call('POST', '/api/company/buildings/b-a2/publish', { token: 'a' });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'NO_PUBLISHED_FLOORS');
      assert.equal(await buildingStatus('b-a2'), 'DRAFT');
    });

    it('edificio ajeno: 404 y sin cambios', async () => {
      const r = await call('POST', '/api/company/buildings/b-b/publish', { token: 'a' });
      assert.equal(r.status, 404);
      assert.equal(await buildingStatus('b-b'), 'DRAFT');
    });

    it('edificio inexistente: 404', async () => {
      const r = await call('POST', '/api/company/buildings/nada/publish', { token: 'a' });
      assert.equal(r.status, 404);
    });
  });

  describe('POST /company/buildings/:id/unpublish', () => {
    it('despublica (200) y es idempotente', async () => {
      await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      const r = await call('POST', '/api/company/buildings/b-a/unpublish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(r.body.publicado, false);
      assert.equal(await buildingStatus('b-a'), 'DRAFT');
      const again = await call('POST', '/api/company/buildings/b-a/unpublish', { token: 'a' });
      assert.equal(again.status, 200);
      assert.equal(again.body.publicado, false);
    });

    it('edificio ajeno: 404', async () => {
      const r = await call('POST', '/api/company/buildings/b-b/unpublish', { token: 'a' });
      assert.equal(r.status, 404);
    });
  });

  describe('POST /company/floors/:id/unpublish', () => {
    it('despublica la planta (200) sin aviso si el edificio es borrador', async () => {
      const r = await call('POST', '/api/company/floors/f-a1/unpublish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, {
        id: 'f-a1',
        buildingId: 'b-a',
        numero: 1,
        nombre: 'P1',
        publicado: false,
        reservasFuturas: 0,
      });
      assert.equal(await floorStatus('f-a1'), 'DRAFT');
    });

    it('con aviso si era la última planta publicada de un edificio publicado', async () => {
      await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      const r = await call('POST', '/api/company/floors/f-a1/unpublish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(typeof r.body.aviso, 'string');
      assert.equal(await buildingStatus('b-a'), 'PUBLISHED');
    });

    it('sin aviso si quedan otras plantas publicadas', async () => {
      await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      await floorModel.update('f-a0', { status: 'PUBLISHED' });
      const r = await call('POST', '/api/company/floors/f-a1/unpublish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(r.body.aviso, undefined);
    });

    it('planta ajena: 404 y sin cambios', async () => {
      const r = await call('POST', '/api/company/floors/f-b/unpublish', { token: 'a' });
      assert.equal(r.status, 404);
      assert.equal(await floorStatus('f-b'), 'PUBLISHED');
    });

    it('la planta despublicada da 404 en GET /api/floors/:id público', async () => {
      await call('POST', '/api/company/floors/f-a1/unpublish', { token: 'a' });
      const res = await fetch(`${baseUrl}/api/floors/f-a1`);
      assert.equal(res.status, 404);
    });
  });

  describe('visibilidad pública del edificio', () => {
    it('aparece en GET /api/buildings al publicar y desaparece al despublicar', async () => {
      const list = async () =>
        (await (await fetch(`${baseUrl}/api/buildings`)).json()).edificios.map((x) => x.id);
      assert.ok(!(await list()).includes('b-a'));
      await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      assert.ok((await list()).includes('b-a'));
      await call('POST', '/api/company/buildings/b-a/unpublish', { token: 'a' });
      assert.ok(!(await list()).includes('b-a'));
      const detail = await fetch(`${baseUrl}/api/buildings/b-a`);
      assert.equal(detail.status, 404);
    });
  });

  describe('reservas futuras al despublicar u ocultar', () => {
    const inDays = (days) => new Date(Date.now() + days * 86400000);
    const mkBooking = (id, roomId, startDate, status = 'CONFIRMED') =>
      bookingModel.create(
        { roomId, companyId: 'c-a', userId: 'u1', startDate, endDate: startDate, status },
        { id },
      );

    beforeEach(async () => {
      await mkBooking('bk1', 'r-pub', inDays(2));
      await mkBooking('bk2', 'r-pub', inDays(3), 'PENDING_PAYMENT');
      await mkBooking('bk-pasada', 'r-pub', inDays(-2));
      await mkBooking('bk-cancel', 'r-pub', inDays(2), 'CANCELLED');
      await mkBooking('bk-otra', 'r-b', inDays(2));
    });

    it('ocultar sala: reservasFuturas y aviso; no bloquea', async () => {
      const r = await call('PATCH', '/api/company/rooms/r-pub/visibility', {
        token: 'a',
        body: { visible: false },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.reservasFuturas, 2);
      assert.match(r.body.aviso, /Hay 2 reservas futuras en esta sala; siguen en pie/);
      assert.equal((await roomModel.findById('r-pub')).bookable, false);
    });

    it('ocultar sala sin reservas futuras: 0 y sin aviso; mostrar no lo incluye', async () => {
      const r = await call('PATCH', '/api/company/rooms/r-oculta/visibility', {
        token: 'a',
        body: { visible: false },
      });
      assert.equal(r.body.reservasFuturas, 0);
      assert.equal(r.body.aviso, undefined);
      const show = await call('PATCH', '/api/company/rooms/r-pub/visibility', {
        token: 'a',
        body: { visible: true },
      });
      assert.equal(show.body.reservasFuturas, undefined);
    });

    it('despublicar planta: cuenta las de sus salas y combina el aviso de última planta', async () => {
      await call('POST', '/api/company/buildings/b-a/publish', { token: 'a' });
      const r = await call('POST', '/api/company/floors/f-a1/unpublish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(r.body.reservasFuturas, 2);
      assert.match(r.body.aviso, /ya no tiene plantas publicadas/);
      assert.match(r.body.aviso, /Hay 2 reservas futuras en esta planta/);
    });

    it('despublicar planta sin reservas futuras en ella: 0 y sin aviso', async () => {
      const r = await call('POST', '/api/company/floors/f-a0/unpublish', { token: 'a' });
      assert.equal(r.body.reservasFuturas, 0);
      assert.equal(r.body.aviso, undefined);
    });

    it('despublicar edificio: cuenta las de todas sus salas', async () => {
      await mkBooking('bk3', 'r-oculta', inDays(1));
      const r = await call('POST', '/api/company/buildings/b-a/unpublish', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(r.body.publicado, false);
      assert.equal(r.body.reservasFuturas, 3);
      assert.match(r.body.aviso, /Hay 3 reservas futuras en este edificio/);
    });

    it('despublicar edificio sin reservas futuras: 0 y sin aviso', async () => {
      const r = await call('POST', '/api/company/buildings/b-a2/unpublish', { token: 'a' });
      assert.equal(r.body.reservasFuturas, 0);
      assert.equal(r.body.aviso, undefined);
    });
  });

  describe('endurecimiento', () => {
    it('PATCH /company/rooms/:id en sala INACTIVE: 400 ROOM_INACTIVE y no escribe', async () => {
      const r = await call('PATCH', '/api/company/rooms/r-inactiva', {
        token: 'a',
        body: { nombre: 'Nueva' },
      });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'ROOM_INACTIVE');
      assert.equal((await roomModel.findById('r-inactiva')).name, 'Sala r-inactiva');
    });

    it('GET /api/buildings no lista edificios PUBLISHED sin plantas publicadas', async () => {
      await buildingModel.update('b-a2', { status: 'PUBLISHED' });
      await buildingModel.update('b-a', { status: 'PUBLISHED' });
      const res = await fetch(`${baseUrl}/api/buildings`);
      const ids = (await res.json()).edificios.map((x) => x.id);
      assert.ok(ids.includes('b-a'));
      assert.ok(!ids.includes('b-a2'));
    });

    it('publicar edificio ignora plantas publicadas de otra empresa', async () => {
      await mkFloor('f-intruso', 'c-b', 'b-a2', 5, 'PUBLISHED');
      const r = await call('POST', '/api/company/buildings/b-a2/publish', { token: 'a' });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'NO_PUBLISHED_FLOORS');
    });
  });

  describe('GET /company/buildings', () => {
    it('solo los suyos, con plantas ordenadas por número y salas ACTIVE', async () => {
      const r = await call('GET', '/api/company/buildings', { token: 'a' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.map((b) => b.id).sort(), ['b-a', 'b-a2']);
      const a = r.body.find((b) => b.id === 'b-a');
      assert.deepEqual(a.plantas, [
        { id: 'f-a0', numero: 0, nombre: 'P0', publicado: false, salas: 2 },
        { id: 'f-a1', numero: 1, nombre: 'P1', publicado: true, salas: 2 },
      ]);
      assert.ok(!JSON.stringify(r.body).includes('f-b'));
    });
  });

  describe('GET /company/rooms', () => {
    const ids = (r) => r.body.map((x) => x.id).sort();

    it('solo las suyas y activas, con el estado correcto', async () => {
      const r = await call('GET', '/api/company/rooms', { token: 'a' });
      assert.equal(r.status, 200);
      assert.deepEqual(ids(r), ['r-cero', 'r-oculta', 'r-pub', 'r-sinprecio']);
      const estado = Object.fromEntries(r.body.map((x) => [x.id, x.estado]));
      assert.equal(estado['r-pub'], 'publicada');
      assert.equal(estado['r-oculta'], 'oculta');
      assert.equal(estado['r-sinprecio'], 'sin_precio');
      assert.equal(estado['r-cero'], 'sin_precio');
    });

    it('filtra por buildingId, floorId y estado', async () => {
      const byBuilding = await call('GET', '/api/company/rooms?buildingId=b-a2', { token: 'a' });
      assert.equal(byBuilding.status, 200);
      assert.deepEqual(byBuilding.body, []);
      const byFloor = await call('GET', '/api/company/rooms?floorId=f-a1', { token: 'a' });
      assert.deepEqual(ids(byFloor), ['r-oculta', 'r-pub']);
      const byEstado = await call('GET', '/api/company/rooms?estado=sin_precio', { token: 'a' });
      assert.deepEqual(ids(byEstado), ['r-cero', 'r-sinprecio']);
      const byAll = await call(
        'GET',
        '/api/company/rooms?buildingId=b-a&floorId=f-a1&estado=publicada',
        { token: 'a' },
      );
      assert.deepEqual(ids(byAll), ['r-pub']);
    });

    it('buildingId o floorId ajeno o inexistente: 404', async () => {
      for (const q of ['buildingId=b-b', 'floorId=f-b']) {
        const r = await call('GET', `/api/company/rooms?${q}`, { token: 'a' });
        assert.equal(r.status, 404);
      }
      for (const q of ['buildingId=nada', 'floorId=nada']) {
        const r = await call('GET', `/api/company/rooms?${q}`, { token: 'a' });
        assert.equal(r.status, 404);
      }
    });

    it('estado inválido: 400 VALIDATION_ERROR', async () => {
      const r = await call('GET', '/api/company/rooms?estado=otro', { token: 'a' });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('PATCH /company/rooms/:id/visibility', () => {
    const patch = (id, body) =>
      call('PATCH', `/api/company/rooms/${id}/visibility`, { token: 'a', body });

    it('mostrar con precio: 200, reservable y publicada', async () => {
      const r = await patch('r-oculta', { visible: true });
      assert.equal(r.status, 200);
      assert.equal(r.body.reservable, true);
      assert.equal(r.body.estado, 'publicada');
      assert.equal((await roomModel.findById('r-oculta')).bookable, true);
    });

    it('ocultar: 200 y oculta', async () => {
      const r = await patch('r-pub', { visible: false });
      assert.equal(r.status, 200);
      assert.equal(r.body.reservable, false);
      assert.equal(r.body.estado, 'oculta');
    });

    it('mostrar sin precio: 400 ROOM_WITHOUT_PRICE', async () => {
      const r = await patch('r-sinprecio', { visible: true });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'ROOM_WITHOUT_PRICE');
      assert.notEqual((await roomModel.findById('r-sinprecio')).bookable, true);
    });

    it('zona común: estado zona_comun y no se puede mostrar (400 ROOM_NOT_RENTABLE)', async () => {
      // Preparar: unos aseos (tipo comun), aunque tuvieran precio.
      await mkRoom('r-aseos', 'c-a', 'b-a', 'f-a0', { type: 'comun', price: 10, bookable: false });
      // Actuar
      const lista = await call('GET', '/api/company/rooms?estado=zona_comun', { token: 'a' });
      const r = await patch('r-aseos', { visible: true });
      // Comprobar
      assert.deepEqual(
        lista.body.map((x) => x.id),
        ['r-aseos'],
      );
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'ROOM_NOT_RENTABLE');
      assert.notEqual((await roomModel.findById('r-aseos')).bookable, true);
    });

    it('sala INACTIVE: 400 ROOM_INACTIVE', async () => {
      const r = await patch('r-inactiva', { visible: true });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'ROOM_INACTIVE');
    });

    it('sala ajena: 404', async () => {
      assert.equal((await patch('r-b', { visible: false })).status, 404);
    });

    it('visible no booleano ("true" o [true]): 400 VALIDATION_ERROR', async () => {
      for (const visible of ['true', [true]]) {
        const r = await patch('r-oculta', { visible });
        assert.equal(r.status, 400);
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('PATCH /company/rooms/:id con reservable', () => {
    const patch = (id, body) => call('PATCH', `/api/company/rooms/${id}`, { token: 'a', body });

    it('reservable:true en sala sin precio: 400 ROOM_WITHOUT_PRICE', async () => {
      const r = await patch('r-sinprecio', { reservable: true });
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'ROOM_WITHOUT_PRICE');
    });

    it('precioHora y reservable:true a la vez: 200', async () => {
      const r = await patch('r-sinprecio', { precioHora: 30, reservable: true });
      assert.equal(r.status, 200);
      assert.equal(r.body.precioHora, 30);
      assert.equal(r.body.reservable, true);
    });
  });
});
