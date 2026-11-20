// Test de integración: edificios, plantas y salas del panel de empresa (/api/company/*),
// con el verificador de tokens y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { setStorageBucketForTests } from '../../src/config/config.js';
import { listen, storageUrl, TEST_BUCKET } from '../helpers/publicData.js';

const foto = (company = 'c-a', file = 'buildings/b-a/photos/f.jpg') =>
  storageUrl(`companies/${company}/${file}`);

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  b: { uid: 'ub', role: 'COMPANY', companyId: 'c-b' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  rech: { uid: 'ur', role: 'COMPANY', companyId: 'c-rech' },
  cliente: { uid: 'uc', role: 'CLIENT' },
};

describe('Panel de empresa: edificios, plantas y salas', () => {
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

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await companyModel.create({ name: 'A', status: 'APPROVED', verified: true }, { id: 'c-a' });
    await companyModel.create({ name: 'B', status: 'APPROVED', verified: true }, { id: 'c-b' });
    await companyModel.create({ name: 'P', status: 'PENDING', verified: false }, { id: 'c-pend' });
    await companyModel.create({ name: 'R', status: 'REJECTED', verified: false }, { id: 'c-rech' });
    await buildingModel.create(
      { companyId: 'c-a', name: 'Edif A', address: 'Calle 1', city: 'Sevilla', status: 'DRAFT' },
      { id: 'b-a' },
    );
    await buildingModel.create(
      { companyId: 'c-b', name: 'Edif B', address: 'Calle 2', city: 'Madrid', status: 'DRAFT' },
      { id: 'b-b' },
    );
    await floorModel.create(
      { companyId: 'c-a', buildingId: 'b-a', name: 'Baja', level: 0, status: 'DRAFT', salas: [] },
      { id: 'f-a0' },
    );
    await floorModel.create(
      {
        companyId: 'c-a',
        buildingId: 'b-a',
        name: 'Primera',
        level: 1,
        status: 'DRAFT',
        salas: [],
      },
      { id: 'f-a1' },
    );
    await floorModel.create(
      { companyId: 'c-b', buildingId: 'b-b', name: 'Baja', level: 0, status: 'DRAFT', salas: [] },
      { id: 'f-b' },
    );
    await roomModel.create(
      {
        companyId: 'c-a',
        floorId: 'f-a0',
        buildingId: 'b-a',
        name: 'Sala A',
        code: 'A1',
        price: 10,
      },
      { id: 'r-a' },
    );
    await roomModel.create(
      {
        companyId: 'c-b',
        floorId: 'f-b',
        buildingId: 'b-b',
        name: 'Sala B',
        code: 'B1',
        price: 20,
      },
      { id: 'r-b' },
    );
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  const endpoints = [
    ['GET', '/api/company/buildings', undefined],
    ['POST', '/api/company/buildings', { nombre: 'x', direccion: 'y', ciudad: 'z' }],
    ['PATCH', '/api/company/buildings/b-a', { nombre: 'x' }],
    ['POST', '/api/company/buildings/b-a/floors', { numero: 5, nombre: 'x' }],
    ['PATCH', '/api/company/floors/f-a0', { nombre: 'x' }],
    ['PATCH', '/api/company/rooms/r-a', { nombre: 'x' }],
  ];

  describe('permisos comunes', () => {
    for (const [method, path, body] of endpoints) {
      it(`${method} ${path}: 401 sin token`, async () => {
        const r = await call(method, path, { body });
        assert.equal(r.status, 401);
      });
      it(`${method} ${path}: 403 FORBIDDEN con rol CLIENT`, async () => {
        const r = await call(method, path, { token: 'cliente', body });
        assert.equal(r.status, 403);
        assert.equal(r.body.error.code, 'FORBIDDEN');
      });
      for (const token of ['pend', 'rech']) {
        it(`${method} ${path}: 403 COMPANY_NOT_APPROVED con empresa ${token}`, async () => {
          const r = await call(method, path, { token, body });
          assert.equal(r.status, 403);
          assert.equal(r.body.error.code, 'COMPANY_NOT_APPROVED');
        });
      }
    }

    it('GET /api/companies/me sigue funcionando con empresa pendiente', async () => {
      const r = await call('GET', '/api/companies/me', { token: 'pend' });
      assert.equal(r.status, 200);
      assert.equal(r.body.estado, 'pendiente');
    });
  });

  describe('GET /api/company/buildings', () => {
    it('devuelve solo los edificios de su empresa, en español', async () => {
      const r = await call('GET', '/api/company/buildings', { token: 'a' });
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 1);
      assert.deepEqual(r.body[0], {
        id: 'b-a',
        nombre: 'Edif A',
        direccion: 'Calle 1',
        ciudad: 'Sevilla',
        descripcion: '',
        fotos: [],
        publicado: false,
        plantas: [
          { id: 'f-a0', numero: 0, nombre: 'Baja', publicado: false, salas: 0 },
          { id: 'f-a1', numero: 1, nombre: 'Primera', publicado: false, salas: 0 },
        ],
      });
    });
  });

  describe('POST /api/company/buildings', () => {
    it('201: crea en borrador con el companyId del token e ignora campos de más', async () => {
      const r = await call('POST', '/api/company/buildings', {
        token: 'a',
        body: {
          nombre: ' Nuevo ',
          direccion: 'Calle 3',
          ciudad: 'Sevilla',
          fotos: [foto()],
          companyId: 'c-b',
          status: 'PUBLISHED',
          publicado: true,
        },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.nombre, 'Nuevo');
      assert.equal(r.body.publicado, false);
      assert.deepEqual(r.body.fotos, [foto()]);
      const doc = await buildingModel.findById(r.body.id);
      assert.equal(doc.companyId, 'c-a');
      assert.equal(doc.status, 'DRAFT');
    });

    it('400 si no hay bucket de Storage configurado', async () => {
      setStorageBucketForTests(undefined);
      try {
        const r = await call('POST', '/api/company/buildings', {
          token: 'a',
          body: { nombre: 'x', direccion: 'y', ciudad: 'z', fotos: [foto()] },
        });
        assert.equal(r.status, 400);
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
        assert.match(JSON.stringify(r.body), /no está configurado/);
      } finally {
        setStorageBucketForTests(TEST_BUCKET);
      }
    });

    it('400 VALIDATION_ERROR con nombre vacío, ausente o fotos no https', async () => {
      const base = { nombre: 'x', direccion: 'y', ciudad: 'z' };
      const casos = [
        { ...base, nombre: '' },
        { ...base, nombre: '   ' },
        { direccion: 'y', ciudad: 'z' },
        { ...base, fotos: ['http://ejemplo.com/f.jpg'] },
        { ...base, fotos: foto() },
        { ...base, fotos: [foto('c-b')] },
      ];
      for (const body of casos) {
        const r = await call('POST', '/api/company/buildings', { token: 'a', body });
        assert.equal(r.status, 400, JSON.stringify(body));
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('PATCH /api/company/buildings/:id', () => {
    it('200: edita un edificio propio e ignora companyId y status', async () => {
      const r = await call('PATCH', '/api/company/buildings/b-a', {
        token: 'a',
        body: { nombre: 'Renombrado', companyId: 'c-b', status: 'PUBLISHED', publicado: true },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.nombre, 'Renombrado');
      assert.equal(r.body.publicado, false);
      const doc = await buildingModel.findById('b-a');
      assert.equal(doc.name, 'Renombrado');
      assert.equal(doc.companyId, 'c-a');
      assert.equal(doc.status, 'DRAFT');
    });

    it('403 FORBIDDEN con edificio ajeno y no cambia', async () => {
      const r = await call('PATCH', '/api/company/buildings/b-b', {
        token: 'a',
        body: { nombre: 'Hackeado' },
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'FORBIDDEN');
      assert.equal((await buildingModel.findById('b-b')).name, 'Edif B');
    });

    it('404 si no existe', async () => {
      const r = await call('PATCH', '/api/company/buildings/nope', {
        token: 'a',
        body: { nombre: 'x' },
      });
      assert.equal(r.status, 404);
      assert.equal(r.body.error.code, 'NOT_FOUND');
    });

    it('400 VALIDATION_ERROR con body vacío o nombre vacío', async () => {
      for (const body of [{}, { nombre: '' }, { fotos: ['ftp://x.com/a.png'] }]) {
        const r = await call('PATCH', '/api/company/buildings/b-a', { token: 'a', body });
        assert.equal(r.status, 400);
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('POST /api/company/buildings/:id/floors', () => {
    it('201: crea la planta en borrador con companyId del token', async () => {
      const r = await call('POST', '/api/company/buildings/b-a/floors', {
        token: 'a',
        body: {
          numero: 2,
          nombre: 'Segunda',
          companyId: 'c-b',
          buildingId: 'b-b',
          status: 'PUBLISHED',
          publicado: true,
        },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.numero, 2);
      assert.equal(r.body.nombre, 'Segunda');
      assert.equal(r.body.buildingId, 'b-a');
      assert.equal(r.body.publicado, false);
      const doc = await floorModel.findById(r.body.id);
      assert.equal(doc.companyId, 'c-a');
      assert.equal(doc.buildingId, 'b-a');
      assert.equal(doc.status, 'DRAFT');
      assert.deepEqual(doc.salas, []);
    });

    it('acepta plantas de sótano (número negativo)', async () => {
      const r = await call('POST', '/api/company/buildings/b-a/floors', {
        token: 'a',
        body: { numero: -1, nombre: 'Sótano' },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.numero, -1);
    });

    it('403 con edificio ajeno y no crea nada', async () => {
      const r = await call('POST', '/api/company/buildings/b-b/floors', {
        token: 'a',
        body: { numero: 5, nombre: 'x' },
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'FORBIDDEN');
      assert.equal((await floorModel.listByBuilding('b-b')).length, 1);
    });

    it('404 si el edificio no existe', async () => {
      const r = await call('POST', '/api/company/buildings/nope/floors', {
        token: 'a',
        body: { numero: 5, nombre: 'x' },
      });
      assert.equal(r.status, 404);
    });

    it('409 FLOOR_EXISTS con número repetido en el edificio', async () => {
      const r = await call('POST', '/api/company/buildings/b-a/floors', {
        token: 'a',
        body: { numero: 1, nombre: 'Otra' },
      });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'FLOOR_EXISTS');
      assert.equal((await floorModel.listByBuilding('b-a')).length, 2);
    });

    it('400 VALIDATION_ERROR con nombre vacío, número inválido o ausente', async () => {
      const casos = [
        { numero: 3, nombre: '' },
        { numero: 3 },
        { nombre: 'x' },
        { numero: 'abc', nombre: 'x' },
        { numero: 1.5, nombre: 'x' },
        { numero: 500, nombre: 'x' },
        { numero: [1], nombre: 'x' },
      ];
      for (const body of casos) {
        const r = await call('POST', '/api/company/buildings/b-a/floors', { token: 'a', body });
        assert.equal(r.status, 400, JSON.stringify(body));
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('PATCH /api/company/floors/:id', () => {
    it('200: edita nombre y número e ignora companyId, buildingId y status', async () => {
      const r = await call('PATCH', '/api/company/floors/f-a0', {
        token: 'a',
        body: {
          nombre: 'Planta baja',
          numero: 7,
          companyId: 'c-b',
          buildingId: 'b-b',
          status: 'PUBLISHED',
        },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.nombre, 'Planta baja');
      assert.equal(r.body.numero, 7);
      assert.equal(r.body.buildingId, 'b-a');
      const doc = await floorModel.findById('f-a0');
      assert.equal(doc.level, 7);
      assert.equal(doc.companyId, 'c-a');
      assert.equal(doc.buildingId, 'b-a');
      assert.equal(doc.status, 'DRAFT');
    });

    it('permite reenviar su propio número', async () => {
      const r = await call('PATCH', '/api/company/floors/f-a0', {
        token: 'a',
        body: { numero: 0 },
      });
      assert.equal(r.status, 200);
    });

    it('409 FLOOR_EXISTS si el número lo tiene otra planta del edificio', async () => {
      const r = await call('PATCH', '/api/company/floors/f-a0', {
        token: 'a',
        body: { numero: 1 },
      });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'FLOOR_EXISTS');
      assert.equal((await floorModel.findById('f-a0')).level, 0);
    });

    it('403 con planta ajena y no cambia', async () => {
      const r = await call('PATCH', '/api/company/floors/f-b', {
        token: 'a',
        body: { nombre: 'Hackeada' },
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'FORBIDDEN');
      assert.equal((await floorModel.findById('f-b')).name, 'Baja');
    });

    it('404 si no existe', async () => {
      const r = await call('PATCH', '/api/company/floors/nope', {
        token: 'a',
        body: { nombre: 'x' },
      });
      assert.equal(r.status, 404);
    });

    it('400 VALIDATION_ERROR con body vacío o nombre vacío', async () => {
      for (const body of [{}, { nombre: '' }, { numero: 'x' }]) {
        const r = await call('PATCH', '/api/company/floors/f-a0', { token: 'a', body });
        assert.equal(r.status, 400);
        assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('PATCH /api/company/rooms/:id', () => {
    const valido = {
      nombre: 'Sala Mayor',
      capacidad: 12,
      m2: 30.5,
      precioHora: 25,
      equipamiento: ['proyector', 'wifi'],
      reservable: true,
      fotos: [foto('c-a', 'rooms/r-a/photos/s.jpg')],
    };

    it('200: edita los datos comerciales con el formato en español', async () => {
      const r = await call('PATCH', '/api/company/rooms/r-a', { token: 'a', body: valido });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, {
        id: 'r-a',
        floorId: 'f-a0',
        buildingId: 'b-a',
        codigo: 'A1',
        ...valido,
      });
      const doc = await roomModel.findById('r-a');
      assert.equal(doc.price, 25);
      assert.equal(doc.pricePeriod, 'HOUR');
      assert.equal(doc.surface, 30.5);
      assert.equal(doc.bookable, true);
    });

    it('ignora companyId, floorId, buildingId y status del body', async () => {
      const r = await call('PATCH', '/api/company/rooms/r-a', {
        token: 'a',
        body: { nombre: 'X', companyId: 'c-b', floorId: 'f-b', buildingId: 'b-b', status: 'X' },
      });
      assert.equal(r.status, 200);
      const doc = await roomModel.findById('r-a');
      assert.equal(doc.companyId, 'c-a');
      assert.equal(doc.floorId, 'f-a0');
      assert.equal(doc.buildingId, 'b-a');
      assert.notEqual(doc.status, 'X');
    });

    it('403 con sala ajena y no cambia', async () => {
      const r = await call('PATCH', '/api/company/rooms/r-b', {
        token: 'a',
        body: { precioHora: 1 },
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'FORBIDDEN');
      assert.equal((await roomModel.findById('r-b')).price, 20);
    });

    it('404 si no existe', async () => {
      const r = await call('PATCH', '/api/company/rooms/nope', {
        token: 'a',
        body: { nombre: 'x' },
      });
      assert.equal(r.status, 404);
    });

    it('400 VALIDATION_ERROR con datos inválidos y la sala no cambia', async () => {
      const casos = {
        'body vacío': {},
        'precioHora 0': { precioHora: 0 },
        'precioHora negativo': { precioHora: -5 },
        'capacidad 0': { capacidad: 0 },
        'capacidad 1.5': { capacidad: 1.5 },
        'm2 0': { m2: 0 },
        'equipamiento no array': { equipamiento: 'wifi' },
        'equipamiento con no-string': { equipamiento: ['wifi', 3] },
        'fotos no https': { fotos: ['http://ejemplo.com/s.jpg'] },
        'foto de otra empresa': { fotos: [foto('c-b')] },
        'foto de otro bucket': { fotos: [storageUrl('companies/c-a/x.jpg', 'otro.appspot.com')] },
        'foto en storage.googleapis.com': {
          fotos: [
            'https://storage.googleapis.com/ipuente-test.firebasestorage.app/companies/c-a/x.jpg',
          ],
        },
        'foto con .. sin codificar': { fotos: [foto('c-a', '../c-b/x.jpg')] },
        'reservable string': { reservable: 'true' },
        'nombre vacío': { nombre: '' },
        'capacidad array': { capacidad: [5] },
        'm2 array': { m2: [1] },
        'precioHora array': { precioHora: [10] },
        'reservable array': { reservable: [true] },
        'nombre array': { nombre: ['x'] },
        'foto > 2048': { fotos: [foto('c-a', `${'a'.repeat(2050)}.jpg`)] },
      };
      for (const [nombre, body] of Object.entries(casos)) {
        const r = await call('PATCH', '/api/company/rooms/r-a', { token: 'a', body });
        assert.equal(r.status, 400, nombre);
        assert.equal(r.body.error.code, 'VALIDATION_ERROR', nombre);
      }
      const doc = await roomModel.findById('r-a');
      assert.equal(doc.price, 10);
      assert.equal(doc.name, 'Sala A');
    });
  });
});
