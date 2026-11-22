// Test de integración: GET /api/floors/:id (mapa público de una planta con el estado de cada sala).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import {
  FECHA,
  getJson,
  listen,
  privateWordsIn,
  seedPublicData,
  seedRoomWithoutPrice,
} from '../helpers/publicData.js';

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

  it('una sala oculta o no reservable no expone precio ni capacidad', async () => {
    const { body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
    for (const id of ['r-nobook', 'r-inactive']) {
      const s = body.salas.find((x) => x.id === id);
      assert.equal(s.precioHora, null);
      assert.equal(s.capacidad, null);
    }
    const busy = body.salas.find((x) => x.id === 'r-busy');
    assert.equal(busy.precioHora, 25);
    assert.equal(busy.capacidad, 10);
  });

  describe('con hora', () => {
    const estadoA = async (hora) => {
      const { status, body, text } = await getJson(
        baseUrl,
        `/api/floors/f-0?fecha=${FECHA}&hora=${hora}`,
      );
      assert.equal(status, 200);
      return { body, text, estado: Object.fromEntries(body.salas.map((s) => [s.id, s.estado])) };
    };

    it('una sala con reserva 10-12 está libre a las 9 y ocupada a las 10 y a las 11', async () => {
      assert.equal((await estadoA(9)).estado['r-busy'], 'FREE');
      assert.equal((await estadoA(10)).estado['r-busy'], 'OCCUPIED');
      assert.equal((await estadoA(11)).estado['r-busy'], 'OCCUPIED');
    });

    it('la hora en que termina la reserva (12) queda libre', async () => {
      assert.equal((await estadoA(12)).estado['r-busy'], 'FREE');
    });

    it('un bloqueo 14-16 ocupa a las 14 y 15 y deja libre a las 13 y a las 16', async () => {
      assert.equal((await estadoA(14)).estado['r-block'], 'OCCUPIED');
      assert.equal((await estadoA(15)).estado['r-block'], 'OCCUPIED');
      assert.equal((await estadoA(13)).estado['r-block'], 'FREE');
      assert.equal((await estadoA(16)).estado['r-block'], 'FREE');
    });

    it('las salas no reservables siguen UNAVAILABLE y las canceladas libres', async () => {
      const { estado } = await estadoA(10);
      assert.equal(estado['r-nobook'], 'UNAVAILABLE');
      assert.equal(estado['r-inactive'], 'UNAVAILABLE');
      assert.equal(estado['r-ghost'], 'UNAVAILABLE');
      assert.equal(estado['r-cancel'], 'FREE');
    });

    it('devuelve la hora pedida y no incluye datos de clientes', async () => {
      const { body, text } = await estadoA(10);
      assert.equal(body.hora, 10);
      assert.deepEqual(privateWordsIn(text), []);
    });

    it('sin hora la respuesta no lleva el campo hora', async () => {
      const { body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
      assert.equal('hora' in body, false);
    });

    for (const hora of ['7', '20', '9.5', 'abc', '']) {
      it(`responde 400 VALIDATION_ERROR con hora=${hora}`, async () => {
        const { status, body } = await getJson(
          baseUrl,
          `/api/floors/f-0?fecha=${FECHA}&hora=${hora}`,
        );
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
        assert.equal(body.error.details[0].field, 'hora');
      });
    }

    for (const q of ['hora[]=10', 'hora[a]=10']) {
      it(`rechaza con 400 VALIDATION_ERROR hora[] y hora[x] (claves con corchetes) (${q})`, async () => {
        const { status, body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}&${q}`);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
        assert.equal(body.error.details[0].field, 'hora');
      });
    }

    it('responde 400 con la hora repetida (hora=10&hora=11)', async () => {
      for (const q of ['hora=10&hora=11']) {
        const { status, body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}&${q}`);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('necesidades (personas y equipamiento)', () => {
    const encaja = async (q) => {
      const { status, body, text } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}&${q}`);
      assert.equal(status, 200);
      return { body, text, map: Object.fromEntries(body.salas.map((s) => [s.id, s.encaja])) };
    };
    const NO_RESERVABLES = ['r-nobook', 'r-inactive', 'r-ghost'];

    beforeEach(async () => {
      // r-block: pequeña y con otro equipamiento; r-cancel: gratis, sin precio; r-free sin lista.
      await roomModel.update('r-block', { capacity: 4, amenities: ['Café', 'WiFi'] });
      await roomModel.update('r-cancel', { isFree: true, price: null, capacity: 3 });
      await roomModel.update('r-free', { amenities: [] });
    });

    it('sin filtros efectivos no existe encaja', async () => {
      for (const q of ['', '&equipamiento=,', '&equipamiento=%20,%20', '&equipamiento=']) {
        const { body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}${q}`);
        assert.equal(
          body.salas.some((s) => 'encaja' in s),
          false,
        );
      }
    });

    it('personas marca las salas con capacidad suficiente y no oculta ninguna', async () => {
      const { map, body } = await encaja('personas=8');
      assert.equal(body.salas.length, 7);
      assert.equal(map['r-busy'], true);
      assert.equal(map['r-free'], true);
      assert.equal(map['r-block'], false);
      assert.equal(map['r-cancel'], false);
      for (const id of NO_RESERVABLES) assert.equal(map[id], false);
    });

    it('una sala gratis reservable puede encajar', async () => {
      assert.equal((await encaja('personas=3')).map['r-cancel'], true);
    });

    it('equipamiento ignora mayúsculas y tildes y una sala sin equipamiento no encaja', async () => {
      const { map } = await encaja('equipamiento=CAFE');
      assert.equal(map['r-block'], true);
      assert.equal(map['r-busy'], false);
      assert.equal(map['r-free'], false);
      assert.equal((await encaja('equipamiento=Café')).map['r-block'], true);
    });

    it('varios equipamientos: debe tenerlos todos', async () => {
      assert.equal((await encaja('equipamiento=wifi,pantalla')).map['r-busy'], true);
      const { map } = await encaja('equipamiento=wifi,pantalla,proyector');
      assert.equal(map['r-busy'], false);
      assert.equal((await encaja('equipamiento=wifi,,')).map['r-block'], true);
    });

    it('personas y equipamiento combinados', async () => {
      const { map } = await encaja('personas=8&equipamiento=wifi');
      assert.equal(map['r-busy'], true);
      assert.equal(map['r-block'], false);
      assert.equal(map['r-free'], false);
    });

    it('encaja mide necesidades, no disponibilidad (ocupada puede ser true)', async () => {
      const { body } = await encaja('personas=8');
      const busy = body.salas.find((s) => s.id === 'r-busy');
      assert.equal(busy.estado, 'OCCUPIED');
      assert.equal(busy.encaja, true);
    });

    it('las salas sin precio no reservables no revelan datos al probar valores', async () => {
      await seedRoomWithoutPrice();
      await roomModel.update('r-noprice', { capacity: 500, amenities: ['wifi'] });
      for (const q of ['personas=500', 'personas=1', 'equipamiento=wifi']) {
        const { map } = await encaja(q);
        for (const id of [...NO_RESERVABLES, 'r-noprice']) assert.equal(map[id], false, id);
      }
    });

    it('una sala eliminada lógicamente es siempre false', async () => {
      await roomModel.update('r-busy', { deletedAt: new Date() });
      assert.equal((await encaja('personas=1')).map['r-busy'], false);
    });

    it('un equipamiento corrupto (no es una lista) no rompe el mapa y no encaja', async () => {
      await roomModel.update('r-busy', { amenities: 'wifi' });
      const { map, body } = await encaja('equipamiento=wifi');
      assert.equal(body.salas.length, 7);
      assert.equal(map['r-busy'], false);
    });

    it('funciona con hora, mantiene los campos y no incluye datos de clientes', async () => {
      const { body, text } = await encaja('hora=10&personas=8');
      assert.equal(body.hora, 10);
      const busy = body.salas.find((s) => s.id === 'r-busy');
      assert.equal(busy.estado, 'OCCUPIED');
      assert.equal(busy.precioHora, 25);
      assert.equal(busy.capacidad, 10);
      assert.deepEqual(privateWordsIn(text), []);
    });

    for (const q of [
      'personas=0',
      'personas=1001',
      'personas=abc',
      'personas=2.5',
      'personas=',
      'personas=2&personas=3',
      'personas[]=2',
      'personas[x]=2',
      'equipamiento=wifi&equipamiento=pantalla',
      'equipamiento[]=wifi',
      'equipamiento[x]=wifi',
      'equipamiento=wi$fi',
    ]) {
      it(`responde 400 VALIDATION_ERROR con ${q}`, async () => {
        const { status, body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}&${q}`);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
        assert.equal(body.error.details[0].field, q.split(/[=[]/)[0]);
      });
    }
  });

  describe('sala reservable sin precio', () => {
    beforeEach(seedRoomWithoutPrice);

    it('no expone precio ni capacidad (null)', async () => {
      const { body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
      const s = body.salas.find((x) => x.id === 'r-noprice');
      assert.equal(s.precioHora, null);
      assert.equal(s.capacidad, null);
    });

    it('figura UNAVAILABLE en el día completo y a una hora', async () => {
      for (const q of ['', '&hora=9']) {
        const { status, body } = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}${q}`);
        assert.equal(status, 200);
        assert.equal(body.salas.find((s) => s.id === 'r-noprice').estado, 'UNAVAILABLE');
      }
    });
  });
});
