// Test de integración: GET /api/buildings y GET /api/buildings/:id (públicos, sin token).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { FECHA, getJson, listen, privateWordsIn, seedPublicData } from '../helpers/publicData.js';

describe('Edificios públicos', () => {
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

  describe('GET /api/buildings', () => {
    it('devuelve solo los edificios PUBLISHED sin campos internos ni datos privados', async () => {
      // Actuar
      const { status, body, text } = await getJson(baseUrl, '/api/buildings');
      // Comprobar
      assert.equal(status, 200);
      assert.deepEqual(
        body.map((b) => b.id),
        ['b-pub'],
      );
      assert.equal(body[0].nombre, 'Edificio publicado');
      for (const campo of ['companyId', 'status', 'demo']) {
        assert.equal(campo in body[0], false, campo);
      }
      assert.deepEqual(privateWordsIn(text), []);
    });
  });

  describe('GET /api/buildings/:id', () => {
    it('devuelve plantas PUBLISHED por nivel y salasLibres sin contar las ocupadas', async () => {
      // Preparar: r-busy (reserva) y r-block (bloqueo) ocupadas; r-free y r-cancel libres.
      // Actuar
      const { status, body, text } = await getJson(baseUrl, `/api/buildings/b-pub?fecha=${FECHA}`);
      // Comprobar
      assert.equal(status, 200);
      assert.deepEqual(
        body.plantas.map((p) => p.id),
        ['f-0', 'f-1'],
      );
      assert.equal(body.plantas[0].salasLibres, 2);
      assert.equal(body.plantas[1].salasLibres, 1);
      assert.equal(body.salasLibres, 3);
      assert.deepEqual(privateWordsIn(text), []);
    });

    it('una reserva CONFIRMED quita la sala de las libres y una CANCELLED no', async () => {
      // Preparar: r-free pasa a tener una reserva confirmada.
      await bookingModel.upsert('bk-conf', {
        userId: 'cliente-secreto',
        roomId: 'r-free',
        startDate: new Date(2026, 5, 15, 17),
        endDate: new Date(2026, 5, 15, 18),
        status: 'CONFIRMED',
      });
      // Actuar
      const { body } = await getJson(baseUrl, `/api/buildings/b-pub?fecha=${FECHA}`);
      // Comprobar: solo r-cancel (cancelada) sigue libre en la planta baja.
      assert.equal(body.plantas[0].salasLibres, 1);
    });

    it('responde 404 si el edificio es DRAFT', async () => {
      const { status, body } = await getJson(baseUrl, '/api/buildings/b-draft');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('responde 404 si el edificio no existe', async () => {
      const { status, body } = await getJson(baseUrl, '/api/buildings/no-existe');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('responde 400 VALIDATION_ERROR con una fecha mala', async () => {
      const { status, body } = await getJson(baseUrl, '/api/buildings/b-pub?fecha=2026-02-30');
      assert.equal(status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(body.error.details[0].field, 'fecha');
    });
  });
});
