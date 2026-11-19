// Test de integración: GET /api/buildings y GET /api/buildings/:id (públicos, sin token).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import * as blockModel from '../../src/models/blockModel.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import {
  FECHA,
  getJson,
  listen,
  privateWordsIn,
  seedPublicData,
  seedSearchData,
  seedRoomWithoutPrice,
} from '../helpers/publicData.js';

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
        body.edificios.map((b) => b.id),
        ['b-pub'],
      );
      assert.equal(body.edificios[0].nombre, 'Edificio publicado');
      for (const campo of ['companyId', 'status', 'demo']) {
        assert.equal(campo in body.edificios[0], false, campo);
      }
      assert.deepEqual(privateWordsIn(text), []);
    });

    describe('buscador', () => {
      const search = (qs) => getJson(baseUrl, `/api/buildings?${qs}`);
      const ids = async (qs) => (await search(qs)).body.edificios.map((b) => b.id);

      beforeEach(async () => {
        await seedSearchData();
      });

      it('sin filtros lista edificios con salas reservables y resume salas, precio y foto', async () => {
        const { body, text } = await search('');
        assert.deepEqual(
          body.edificios.map((b) => b.id),
          ['b-mal', 'b-pub'],
        );
        assert.deepEqual([body.total, body.page, body.limit], [2, 1, 20]);
        const [mal, pub] = body.edificios;
        assert.deepEqual(
          [mal.salasDisponibles, mal.precioDesde, mal.foto],
          [3, 10, 'https://example.com/malaga.jpg'],
        );
        assert.deepEqual([pub.salasDisponibles, pub.precioDesde, pub.foto], [5, 25, null]);
        assert.equal(mal.ciudad, 'Málaga');
        assert.equal('companyId' in mal, false);
        assert.equal(text.includes('c1'), false);
        assert.deepEqual(privateWordsIn(text), []);
      });

      it('nunca devuelve edificios DRAFT, plantas DRAFT, salas no reservables ni edificios sin salas reservables', async () => {
        const { body } = await search('');
        const all = body.edificios.map((b) => b.id);
        assert.ok(!all.includes('b-draft'));
        assert.ok(!all.includes('b-empty'));
        // r-mal-draft (1 €, planta DRAFT) no cuenta: el mínimo de Málaga sigue siendo 10.
        assert.equal(body.edificios.find((b) => b.id === 'b-mal').precioDesde, 10);
        // r-nobook, r-inactive y r-ghost no cuentan: b-pub tiene 5 salas.
        assert.equal(body.edificios.find((b) => b.id === 'b-pub').salasDisponibles, 5);
        assert.deepEqual(await ids('personas=100'), []);
      });

      it('ciudad: contiene, sin mayúsculas ni tildes', async () => {
        assert.deepEqual(await ids('ciudad=malaga'), ['b-mal']);
        assert.deepEqual(await ids('ciudad=M%C3%81LAG'), ['b-mal']);
        assert.deepEqual(await ids('ciudad=evil'), ['b-pub']);
        assert.deepEqual(await ids('ciudad=zaragoza'), []);
      });

      it('personas es la capacidad mínima', async () => {
        assert.deepEqual(await ids('personas=10'), ['b-pub', 'b-mal']);
        assert.deepEqual(await ids('personas=11'), ['b-mal']);
        const { body } = await search('personas=11');
        assert.equal(body.edificios[0].salasDisponibles, 1);
        assert.deepEqual(await ids('personas=41'), []);
      });

      it('equipamiento exige todos los elementos, normalizados', async () => {
        assert.deepEqual(await ids('equipamiento=wifi'), ['b-mal', 'b-pub']);
        assert.deepEqual(await ids('equipamiento=proyector'), ['b-mal']);
        assert.deepEqual(await ids('equipamiento=WiFi,%20Pantalla'), ['b-pub', 'b-mal']);
        const { body } = await search('equipamiento=wifi,pantalla&ciudad=malaga');
        assert.equal(body.edificios[0].salasDisponibles, 1);
        assert.deepEqual(await ids('equipamiento=wifi,proyector,pantalla&ciudad=sevilla'), []);
      });

      it('tipo filtra por sala o box', async () => {
        assert.deepEqual(await ids('tipo=box'), ['b-mal']);
        assert.deepEqual(await ids('tipo=sala'), ['b-mal', 'b-pub']);
      });

      it('precioMax es el precio máximo por hora', async () => {
        assert.deepEqual(await ids('precioMax=10'), ['b-mal']);
        assert.deepEqual(await ids('precioMax=25'), ['b-mal', 'b-pub']);
        assert.deepEqual(await ids('precioMax=9.99'), []);
      });

      it('fecha excluye las salas sin ninguna hora libre ese día', async () => {
        // r-mal-full (4 pers., 15 €) encaja con los filtros pero está ocupada de 8 a 20.
        const qs = 'ciudad=malaga&personas=3&precioMax=20';
        assert.deepEqual(await ids(qs), ['b-mal']);
        assert.deepEqual(await ids(`${qs}&fecha=${FECHA}`), []);
        assert.deepEqual(await ids(`${qs}&fecha=2026-06-16`), ['b-mal']);
      });

      it('fecha: una sala ocupada o bloqueada todo el día no cuenta', async () => {
        const qs = `fecha=${FECHA}&ciudad=sevilla`;
        const antes = (await search(qs)).body.edificios[0].salasDisponibles;
        await blockModel.upsert('bl-all', {
          companyId: 'c1',
          roomId: 'r-up',
          startDate: new Date(2026, 5, 15, 8),
          endDate: new Date(2026, 5, 15, 20),
        });
        const despues = (await search(qs)).body.edificios[0].salasDisponibles;
        assert.equal(despues, antes - 1);
        // Una reserva parcial deja huecos: r-busy (10-12) sigue contando.
        assert.equal(despues, 5 - 1);
      });

      it('combina varios filtros', async () => {
        assert.deepEqual(
          await ids('ciudad=malaga&personas=30&equipamiento=proyector&tipo=sala&precioMax=60'),
          ['b-mal'],
        );
        assert.deepEqual(await ids('ciudad=malaga&personas=30&precioMax=59'), []);
        assert.deepEqual(await ids(`ciudad=sevilla&tipo=box&fecha=${FECHA}`), []);
      });

      it('pagina con page y limit, y total cuenta antes de paginar', async () => {
        const p1 = (await search('limit=1')).body;
        assert.deepEqual(
          [p1.edificios.map((b) => b.id), p1.total, p1.page, p1.limit],
          [['b-mal'], 2, 1, 1],
        );
        const p2 = (await search('limit=1&page=2')).body;
        assert.deepEqual([p2.edificios.map((b) => b.id), p2.total, p2.page], [['b-pub'], 2, 2]);
        const p3 = (await search('limit=1&page=3')).body;
        assert.deepEqual([p3.edificios, p3.total], [[], 2]);
      });

      it('orden=precio (por defecto) ordena por precio desde y desempata por más salas', async () => {
        assert.deepEqual(await ids('orden=precio'), ['b-mal', 'b-pub']);
        await roomModel.update('r-mal-box', { price: 25 });
        await roomModel.update('r-mal-full', { price: 25 });
        // Mismo precio desde (25): primero el que tiene más salas.
        assert.deepEqual(await ids(''), ['b-pub', 'b-mal']);
      });

      it('orden=salas ordena por más salas y desempata por precio y nombre', async () => {
        assert.deepEqual(await ids('orden=salas'), ['b-pub', 'b-mal']);
        // Empate a 5 salas: gana el más barato.
        await roomModel.upsert('r-mal-x1', {
          ...(await roomModel.findById('r-mal-full')),
          price: 30,
        });
        await roomModel.upsert('r-mal-x2', {
          ...(await roomModel.findById('r-mal-full')),
          price: 30,
        });
        assert.deepEqual(await ids('orden=salas'), ['b-mal', 'b-pub']);
        // Empate también en precio: por nombre («Centro Málaga» antes que «Edificio publicado»).
        await roomModel.update('r-mal-box', { price: 25 });
        await roomModel.update('r-mal-full', { price: 25 });
        assert.deepEqual(await ids('orden=salas'), ['b-mal', 'b-pub']);
      });

      it('responde 400 con parámetros inválidos', async () => {
        const malos = [
          'personas=0',
          'personas=1001',
          'personas=1.5',
          'personas=abc',
          'tipo=oficina',
          'precioMax=0',
          'precioMax=10001',
          'precioMax=abc',
          'orden=barato',
          'page=0',
          'page=1.5',
          'limit=0',
          'limit=51',
          'fecha=2026-02-30',
          `ciudad=${'a'.repeat(101)}`,
          'ciudad=a&ciudad=b',
          'ciudad[]=x',
          'personas[a]=3',
          'equipamiento[]=wifi',
          'equipamiento=wi$fi',
          `equipamiento=${Array.from({ length: 31 }, (_, i) => `e${i}`).join(',')}`,
          `equipamiento=${'a'.repeat(51)}`,
        ];
        for (const qs of malos) {
          const { status, body } = await search(qs);
          assert.equal(status, 400, qs);
          assert.equal(body.error.code, 'VALIDATION_ERROR', qs);
        }
      });

      it('acepta tildes en el equipamiento y límites correctos', async () => {
        assert.equal((await search('equipamiento=Pantalla%20Gr%C3%A1nde')).status, 200);
        assert.equal((await search('limit=50&personas=1000&precioMax=10000')).status, 200);
      });
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

    it('una sala reservable sin precio no cuenta como libre', async () => {
      const antes = await getJson(baseUrl, `/api/buildings/b-pub?fecha=${FECHA}`);
      await seedRoomWithoutPrice();
      const { status, body } = await getJson(baseUrl, `/api/buildings/b-pub?fecha=${FECHA}`);
      assert.equal(status, 200);
      assert.equal(body.salasLibres, antes.body.salasLibres);
    });
  });
});
