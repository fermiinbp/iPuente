// Test de integración: GET /api/rooms/:id y GET /api/rooms/:id/availability (públicos, sin token).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import {
  FECHA,
  getJson,
  listen,
  privateWordsIn,
  seedPublicData,
  seedRoomWithoutPrice,
} from '../helpers/publicData.js';

const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

describe('Salas públicas', () => {
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

  describe('GET /api/rooms/:id', () => {
    it('devuelve la ficha con los campos en español', async () => {
      // Actuar
      const { status, body, text } = await getJson(baseUrl, '/api/rooms/r-free');
      // Comprobar
      assert.equal(status, 200);
      assert.equal(body.id, 'r-free');
      assert.equal(body.nombre, 'Sala r-free');
      assert.equal(body.tipo, 'sala');
      assert.equal(body.capacidad, 10);
      assert.equal(body.m2, 40);
      assert.equal(body.precioHora, 25);
      assert.deepEqual(body.equipamiento, ['wifi', 'pantalla']);
      assert.deepEqual(body.fotos, ['https://example.com/foto.jpg']);
      assert.equal(body.reservable, true);
      assert.equal(body.edificio.id, 'b-pub');
      assert.equal(body.edificio.nombre, 'Edificio publicado');
      assert.deepEqual(body.planta, { id: 'f-0', nombre: 'Planta baja', nivel: 0 });
      assert.deepEqual(privateWordsIn(text), []);
    });

    for (const [titulo, id] of [
      ['inexistente', 'no-existe'],
      ['no reservable (oculta)', 'r-nobook'],
      ['INACTIVE', 'r-inactive'],
      ['de una planta DRAFT', 'r-draftfloor'],
      ['de un edificio DRAFT', 'r-in-draft'],
    ]) {
      it(`responde 404 si la sala es ${titulo}`, async () => {
        const { status, body } = await getJson(baseUrl, `/api/rooms/${id}`);
        assert.equal(status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
      });
    }

    it('responde 400 si el id lleva caracteres no válidos (p. ej. «/»)', async () => {
      const { status, body } = await getJson(baseUrl, '/api/rooms/r-free%2Fx%2Fy');
      assert.equal(status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(body.error.details[0].field, 'id');
    });
  });

  describe('GET /api/rooms/:id/availability', () => {
    it('excluye la franja confirmada e incluye la cancelada (rango 8-20)', async () => {
      // Actuar: r-busy tiene una reserva CONFIRMED de 10 a 12.
      const busy = await getJson(baseUrl, `/api/rooms/r-busy/availability?fecha=${FECHA}`);
      const cancel = await getJson(baseUrl, `/api/rooms/r-cancel/availability?fecha=${FECHA}`);
      // Comprobar
      assert.equal(busy.status, 200);
      assert.equal(busy.body.desde, 8);
      assert.equal(busy.body.hasta, 20);
      assert.equal(busy.body.fecha, FECHA);
      assert.deepEqual(
        busy.body.horasLibres,
        HORAS.filter((h) => h !== 10 && h !== 11),
      );
      assert.deepEqual(cancel.body.horasLibres, HORAS);
      assert.deepEqual(privateWordsIn(busy.text + cancel.text), []);
    });

    it('excluye la franja de un bloqueo', async () => {
      const { body } = await getJson(baseUrl, `/api/rooms/r-block/availability?fecha=${FECHA}`);
      assert.deepEqual(
        body.horasLibres,
        HORAS.filter((h) => h !== 14 && h !== 15),
      );
    });

    it('responde 404 en la ficha y la disponibilidad de una sala reservable sin precio', async () => {
      await seedRoomWithoutPrice();
      for (const path of [
        '/api/rooms/r-noprice',
        `/api/rooms/r-noprice/availability?fecha=${FECHA}`,
      ]) {
        const { status, body } = await getJson(baseUrl, path);
        assert.equal(status, 404, path);
        assert.equal(body.error.code, 'NOT_FOUND');
      }
    });

    it('responde 404 si la sala no existe, no es pública o no es reservable', async () => {
      for (const id of ['no-existe', 'r-nobook', 'r-inactive', 'r-draftfloor']) {
        const { status, body } = await getJson(
          baseUrl,
          `/api/rooms/${id}/availability?fecha=${FECHA}`,
        );
        assert.equal(status, 404, id);
        assert.equal(body.error.code, 'NOT_FOUND');
      }
    });

    it('responde 400 VALIDATION_ERROR con una fecha mala', async () => {
      const { status, body } = await getJson(baseUrl, '/api/rooms/r-free/availability?fecha=hoy');
      assert.equal(status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(body.error.details[0].field, 'fecha');
    });
  });
});
