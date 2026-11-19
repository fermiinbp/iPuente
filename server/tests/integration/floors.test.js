// Test de integración: GET /api/floors/:id (mapa público de una planta con el estado de cada sala).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { FECHA, getJson, listen, privateWordsIn, seedPublicData } from '../helpers/publicData.js';

describe('Mapa público de una planta', () => {
  let server;
  let baseUrl;

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    await seedPublicData();
  });

  after(async () => {
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  it('devuelve ancho, alto y el estado de cada sala', async () => {
    // Actuar
    const { status, body, text } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
    // Comprobar
    assert.equal(status, 200);
    assert.equal(body.ancho, 1000);
    assert.equal(body.alto, 600);
    assert.equal(body.fecha, FECHA);
    assert.equal(body.edificioId, 'b-pub');
    const estado = Object.fromEntries(body.salas.map((s) => [s.id, s.estado]));
    assert.deepEqual(estado, {
      'r-free': 'FREE',
      'r-busy': 'OCCUPIED',
      'r-cancel': 'FREE',
      'r-block': 'OCCUPIED',
      'r-nobook': 'UNAVAILABLE',
      'r-inactive': 'UNAVAILABLE',
      'r-ghost': 'UNAVAILABLE',
    });
    const free = body.salas.find((s) => s.id === 'r-free');
    assert.equal(free.capacidad, 10);
    assert.equal(free.precioHora, 25);
    const ghost = body.salas.find((s) => s.id === 'r-ghost');
    assert.equal(ghost.capacidad, null);
    assert.deepEqual(privateWordsIn(text), []);
  });

  for (const [titulo, id] of [
    ['una planta DRAFT', 'f-draft'],
    ['una planta de un edificio DRAFT', 'f-in-draft'],
    ['una planta inexistente', 'no-existe'],
  ]) {
    it(`responde 404 para ${titulo}`, async () => {
      const { status, body } = await getJson(baseUrl, `/api/floors/${id}?fecha=${FECHA}`);
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
    });
  }

  for (const fecha of ['2026-02-30', 'hoy']) {
    it(`responde 400 VALIDATION_ERROR con fecha ${fecha}`, async () => {
      const { status, body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${fecha}`);
      assert.equal(status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(body.error.details[0].field, 'fecha');
    });
  }
});
