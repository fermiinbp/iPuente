// Test de integración: guardar y publicar el mapa de una planta (/api/company/floors/:id/map y /publish),
// con el verificador de tokens y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { setStorageBucketForTests } from '../../src/config/config.js';
import { listen, storageUrl, TEST_BUCKET } from '../helpers/publicData.js';

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  cliente: { uid: 'uc', role: 'CLIENT' },
};

const sala = (id, over = {}) => ({
  id,
  codigo: id.toUpperCase(),
  nombre: `Sala ${id}`,
  tipo: 'sala',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  ...over,
});
const mapa = (salas, over = {}) => ({ ancho: 1000, alto: 600, origen: 'manual', salas, ...over });

describe('Mapa de planta: guardar y publicar', () => {
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
  const put = (id, body, token = 'a') =>
    call('PUT', `/api/company/floors/${id}/map`, { token, body });
  const publish = (id, token = 'a') => call('POST', `/api/company/floors/${id}/publish`, { token });

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await companyModel.create({ name: 'A', status: 'APPROVED', verified: true }, { id: 'c-a' });
    await companyModel.create({ name: 'B', status: 'APPROVED', verified: true }, { id: 'c-b' });
    await companyModel.create({ name: 'P', status: 'PENDING', verified: false }, { id: 'c-pend' });
    await floorModel.create(
      { companyId: 'c-a', buildingId: 'b-a', name: 'Baja', level: 0, status: 'DRAFT', salas: [] },
      { id: 'f-a' },
    );
    await floorModel.create(
      { companyId: 'c-b', buildingId: 'b-b', name: 'Baja', level: 0, status: 'DRAFT', salas: [] },
      { id: 'f-b' },
    );
    await roomModel.create(
      { companyId: 'c-b', buildingId: 'b-b', floorId: 'f-b', name: 'Ajena', code: 'X', price: 9 },
      { id: 'r-ajena' },
    );
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  // Guarda una sala en f-a y la deja reservable con precio.
  async function seedBookable(id = 'r1') {
    await put('f-a', mapa([sala(id)]));
    await roomModel.update(id, { bookable: true, price: 25, capacity: 8 });
  }

  describe('permisos', () => {
    const cases = [
      ['PUT', '/api/company/floors/f-a/map', mapa([])],
      ['POST', '/api/company/floors/f-a/publish', undefined],
    ];
    for (const [method, path, body] of cases) {
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

  describe('mapImageUrl', () => {
    const own = storageUrl('companies/c-a/floors/f-a/plan.png');

    it('200: guarda la URL propia en la planta y la devuelve', async () => {
      const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: own }));
      assert.equal(r.status, 200);
      assert.equal(r.body.mapImageUrl, own);
      assert.equal((await floorModel.findById('f-a')).mapImageUrl, own);
    });

    it('400 con URL ajena, otro bucket, http, .., storage.googleapis.com o demasiado larga', async () => {
      const bad = [
        storageUrl('companies/c-b/floors/f-b/plan.png'),
        storageUrl('companies/c-a/plan.png', 'otro.appspot.com'),
        own.replace('https:', 'http:'),
        storageUrl('companies/c-a/x/../../c-b/plan.png').replace(/%2E/g, '.'),
        'https://storage.googleapis.com/ipuente-test.firebasestorage.app/companies/c-a/p.png',
        storageUrl(`companies/c-a/${'a'.repeat(2100)}.png`),
        'https://ejemplo.com/plano.png',
      ];
      for (const url of bad) {
        const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: url }));
        assert.equal(r.status, 400, url.slice(0, 80));
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      }
      assert.equal((await floorModel.findById('f-a')).mapImageUrl, undefined);
    });

    it('null quita el plano: 200 y se guarda null', async () => {
      await put('f-a', mapa([sala('r1')], { mapImageUrl: own }));
      const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: null }));
      assert.equal(r.status, 200);
      assert.equal(r.body.mapImageUrl, null);
      assert.equal((await floorModel.findById('f-a')).mapImageUrl, null);
    });

    it('400 con fragmento o parámetros extra', async () => {
      for (const url of [
        `${own}#x`,
        `${own}&export=1`,
        `${own}&alt=json`,
        `${own}&token=a&token=b`,
      ]) {
        const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: url }));
        assert.equal(r.status, 400, url.slice(-30));
      }
    });

    it('guarda la URL normalizada (host en mayúsculas, parámetros en otro orden)', async () => {
      const raw = own.replace(
        'https://firebasestorage.googleapis.com',
        'HTTPS://FirebaseStorage.GoogleAPIs.com',
      );
      const messy = raw.replace('?alt=media&token=t', '?token=t&alt=media');
      const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: messy }));
      assert.equal(r.status, 200);
      assert.equal((await floorModel.findById('f-a')).mapImageUrl, own);
    });

    it('400 con %2E%2E codificado en el path', async () => {
      const url = `https://firebasestorage.googleapis.com/v0/b/${TEST_BUCKET}/o/companies%2Fc-a%2F%2E%2E%2Fc-b%2Fp.png?alt=media`;
      const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: url }));
      assert.equal(r.status, 400);
    });

    it('400 si no hay bucket configurado', async () => {
      setStorageBucketForTests(undefined);
      try {
        const r = await put('f-a', mapa([sala('r1')], { mapImageUrl: own }));
        assert.equal(r.status, 400);
      } finally {
        setStorageBucketForTests(TEST_BUCKET);
      }
    });
  });

  describe('PUT /api/company/floors/:id/map', () => {
    it('guarda el mapa propio y crea las rooms sin cambiar el status', async () => {
      const r = await put('f-a', mapa([sala('s1'), sala('s2', { x: 100, tipo: 'box' })]));
      assert.equal(r.status, 200);
      assert.equal(r.body.salasCreadas, 2);
      assert.equal(r.body.salasDesactivadas, 0);
      const floor = await floorModel.findById('f-a');
      assert.equal(floor.ancho, 1000);
      assert.equal(floor.alto, 600);
      assert.equal(floor.origen, 'manual');
      assert.equal(floor.salas.length, 2);
      assert.equal(floor.status, 'DRAFT');
      const room = await roomModel.findById('s2');
      assert.equal(room.companyId, 'c-a');
      assert.equal(room.buildingId, 'b-a');
      assert.equal(room.floorId, 'f-a');
      assert.equal(room.type, 'box');
      assert.equal(room.bookable, false);
      assert.equal(room.price, null);
    });

    it('acepta el mapa real floor-0.json', async () => {
      const url = new URL('../../scripts/data/floor-0.json', import.meta.url);
      const { ancho, alto, origen, salas } = JSON.parse(readFileSync(url, 'utf8'));
      const r = await put('f-a', { ancho, alto, origen, salas });
      assert.equal(r.status, 200);
      assert.equal(r.body.salasCreadas, salas.length);
    });

    it('al volver a guardar conserva los datos comerciales y actualiza name, code y type', async () => {
      await seedBookable('r1');
      const nueva = sala('r1', { nombre: 'Nueva', codigo: 'N1', tipo: 'box' });
      const r = await put('f-a', mapa([nueva]));
      assert.equal(r.status, 200);
      assert.equal(r.body.salasCreadas, 0);
      const room = await roomModel.findById('r1');
      assert.equal(room.price, 25);
      assert.equal(room.capacity, 8);
      assert.equal(room.bookable, true);
      assert.equal(room.name, 'Nueva');
      assert.equal(room.code, 'N1');
      assert.equal(room.type, 'box');
    });

    it('una sala quitada del mapa se desactiva y no se borra', async () => {
      await seedBookable('r1');
      await put('f-a', mapa([sala('r1'), sala('r2')]));
      const r = await put('f-a', mapa([sala('r2')]));
      assert.equal(r.status, 200);
      assert.equal(r.body.salasDesactivadas, 1);
      const room = await roomModel.findById('r1');
      assert.ok(room);
      assert.equal(room.bookable, false);
      assert.equal(room.price, 25);
    });

    it('planta ajena: 403 y no cambia nada', async () => {
      const r = await put('f-b', mapa([sala('x1')]));
      assert.equal(r.status, 403);
      assert.deepEqual((await floorModel.findById('f-b')).salas, []);
      assert.equal(await roomModel.findById('x1'), null);
    });

    it('planta inexistente: 404', async () => {
      assert.equal((await put('no-existe', mapa([]))).status, 404);
    });

    it('mapa inválido: 400 VALIDATION_ERROR con details', async () => {
      const r = await put('f-a', mapa([sala('s1', { x: 950, w: 100 })]));
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      assert.equal(r.body.error.details[0].field, 'salas[0].w');
      assert.deepEqual((await floorModel.findById('f-a')).salas, []);
    });

    it('id de una room de otra planta: 409 ROOM_ID_TAKEN y esa room no cambia', async () => {
      const r = await put('f-a', mapa([sala('r-ajena', { nombre: 'Robada' })]));
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'ROOM_ID_TAKEN');
      const room = await roomModel.findById('r-ajena');
      assert.equal(room.name, 'Ajena');
      assert.equal(room.floorId, 'f-b');
      assert.deepEqual((await floorModel.findById('f-a')).salas, []);
    });

    it('más de 490 escrituras: 400 TOO_MANY_CHANGES y no cambia nada', async () => {
      for (let i = 0; i < 491; i += 1) {
        await roomModel.create(
          {
            companyId: 'c-a',
            buildingId: 'b-a',
            floorId: 'f-a',
            name: 'v',
            code: 'v',
            bookable: true,
          },
          { id: `old${i}` },
        );
      }
      const r = await put('f-a', mapa([sala('nueva')]));
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'TOO_MANY_CHANGES');
      assert.equal(await roomModel.findById('nueva'), null);
      assert.equal((await roomModel.findById('old0')).bookable, true);
      assert.deepEqual((await floorModel.findById('f-a')).salas, []);
    });

    it('room de la planta con otra empresa: 409 ROOM_ID_TAKEN', async () => {
      await roomModel.create(
        { companyId: 'c-b', buildingId: 'b-a', floorId: 'f-a', name: 'x', code: 'x' },
        { id: 'raro' },
      );
      const r = await put('f-a', mapa([sala('s1')]));
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'ROOM_ID_TAKEN');
    });

    it('una room INACTIVE que vuelve al mapa se reactiva sin tocar sus datos comerciales', async () => {
      await put('f-a', mapa([sala('r1')]));
      await roomModel.update('r1', { status: 'INACTIVE', price: 25, bookable: false });
      await put('f-a', mapa([sala('r1', { nombre: 'Otro' })]));
      const room = await roomModel.findById('r1');
      assert.equal(room.status, 'ACTIVE');
      assert.equal(room.bookable, false);
      assert.equal(room.price, 25);
      assert.equal(room.name, 'Otro');
    });

    it('sala quitada sin ser reservable: INACTIVE; ya INACTIVE no cuenta como desactivada', async () => {
      await put('f-a', mapa([sala('r1'), sala('r2')]));
      const r = await put('f-a', mapa([sala('r2')]));
      assert.equal(r.body.salasDesactivadas, 1);
      assert.equal((await roomModel.findById('r1')).status, 'INACTIVE');
      assert.equal((await roomModel.findById('r1')).bookable, false);
      const again = await put('f-a', mapa([sala('r2')]));
      assert.equal(again.body.salasDesactivadas, 0);
    });

    it('sala quitada del mapa: fuera del panel, 400 ROOM_INACTIVE, 404 público y se reactiva', async () => {
      await seedBookable('r1');
      await put('f-a', mapa([sala('r1'), sala('r2')]));
      await put('f-a', mapa([sala('r2')]));
      assert.equal((await roomModel.findById('r1')).status, 'INACTIVE');
      const list = await call('GET', '/api/company/rooms', { token: 'a' });
      assert.ok(!list.body.some((x) => x.id === 'r1'));
      const vis = await call('PATCH', '/api/company/rooms/r1/visibility', {
        token: 'a',
        body: { visible: true },
      });
      assert.equal(vis.status, 400);
      assert.equal(vis.body.error.code, 'ROOM_INACTIVE');
      const patch = await call('PATCH', '/api/company/rooms/r1', {
        token: 'a',
        body: { nombre: 'X' },
      });
      assert.equal(patch.status, 400);
      assert.equal(patch.body.error.code, 'ROOM_INACTIVE');
      assert.equal((await fetch(`${baseUrl}/api/rooms/r1`)).status, 404);
      await put('f-a', mapa([sala('r1'), sala('r2')]));
      assert.equal((await roomModel.findById('r1')).status, 'ACTIVE');
    });

    it('planta publicada sin salas reservables: 200 con aviso y sigue PUBLISHED', async () => {
      await seedBookable('r1');
      assert.equal((await publish('f-a')).status, 200);
      const ok = await put('f-a', mapa([sala('r1'), sala('r2')]));
      assert.equal(ok.status, 200);
      assert.equal(ok.body.aviso, undefined);
      const r = await put('f-a', mapa([sala('r2')]));
      assert.equal(r.status, 200);
      assert.ok(r.body.aviso);
      assert.equal((await floorModel.findById('f-a')).status, 'PUBLISHED');
    });
  });

  describe('POST /api/company/floors/:id/publish', () => {
    it('sin mapa: 400 MAP_REQUIRED', async () => {
      const r = await publish('f-a');
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'MAP_REQUIRED');
    });

    it('sin sala reservable con precio: 400 NO_BOOKABLE_ROOMS', async () => {
      await put('f-a', mapa([sala('r1')]));
      const r = await publish('f-a');
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'NO_BOOKABLE_ROOMS');
      assert.equal((await floorModel.findById('f-a')).status, 'DRAFT');
    });

    it('única sala reservable con status INACTIVE: 400 NO_BOOKABLE_ROOMS', async () => {
      await seedBookable('r1');
      await roomModel.update('r1', { status: 'INACTIVE' });
      const r = await publish('f-a');
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'NO_BOOKABLE_ROOMS');
      assert.equal((await floorModel.findById('f-a')).status, 'DRAFT');
    });

    it('correcto: 200 y status PUBLISHED; es idempotente', async () => {
      await seedBookable('r1');
      const r = await publish('f-a');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { id: 'f-a', publicado: true });
      assert.equal((await floorModel.findById('f-a')).status, 'PUBLISHED');
      const again = await publish('f-a');
      assert.equal(again.status, 200);
      assert.deepEqual(again.body, { id: 'f-a', publicado: true });
    });

    it('planta ajena: 403 y no se publica', async () => {
      const r = await publish('f-b');
      assert.equal(r.status, 403);
      assert.equal((await floorModel.findById('f-b')).status, 'DRAFT');
    });

    it('planta inexistente: 404', async () => {
      assert.equal((await publish('no-existe')).status, 404);
    });
  });
});
