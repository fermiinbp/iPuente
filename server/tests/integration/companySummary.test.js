// Test de integración de GET /api/company/summary (resumen del panel de empresa) con el verificador
// de tokens y Firestore sustituidos por dobles: permisos, aislamiento entre empresas, cifras,
// bordes del mes (con `now` inyectado en el service), próximas reservas y tareas pendientes.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import * as userModel from '../../src/models/userModel.js';
import { getSummary } from '../../src/services/companySummaryService.js';
import { addDays, monthRange, todayString } from '../../src/utils/dates.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  b: { uid: 'ub', role: 'COMPANY', companyId: 'c-b' },
  nueva: { uid: 'un', role: 'COMPANY', companyId: 'c-new' },
  soloDel: { uid: 'ud', role: 'COMPANY', companyId: 'c-del' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  cliente: { uid: 'uc', role: 'CLIENT' },
  admin: { uid: 'uadm', role: 'ADMIN' },
};

describe('GET /api/company/summary', () => {
  let server;
  let baseUrl;

  async function get(path = '/api/company/summary', token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text, headers: res.headers };
  }

  const mkBuilding = (id, companyId, name, extra = {}) =>
    buildingModel.create(
      { companyId, name, address: 'Calle 1', city: 'Sevilla', status: 'DRAFT', ...extra },
      { id },
    );
  const mkFloor = (id, companyId, buildingId, level, status, extra = {}) =>
    floorModel.create(
      { companyId, buildingId, name: `P${level}`, level, status, salas: [], ...extra },
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
        photos: ['https://img/x.png'],
        ...extra,
      },
      { id },
    );
  // Reserva que empieza en `start` (Date) y dura 2 horas.
  const mkBooking = (id, companyId, roomId, start, status, totalAmount = 10, extra = {}) =>
    bookingModel.create(
      {
        code: `IP-${id}`,
        userId: 'u1',
        companyId,
        roomId,
        startDate: start,
        endDate: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        price: totalAmount / 2,
        pricePeriod: 'HOUR',
        totalAmount,
        status,
        ...extra,
      },
      { id },
    );
  const inDays = (days) => {
    const [y, m, d] = addDays(todayString(), days).split('-').map(Number);
    return new Date(y, m - 1, d, 10);
  };

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    const approved = { status: 'APPROVED', verified: true };
    await companyModel.create({ name: 'A', ...approved }, { id: 'c-a' });
    await companyModel.create({ name: 'B', ...approved }, { id: 'c-b' });
    await companyModel.create({ name: 'N', ...approved }, { id: 'c-new' });
    await companyModel.create({ name: 'D', ...approved }, { id: 'c-del' });
    await companyModel.create({ name: 'P', status: 'PENDING', verified: false }, { id: 'c-pend' });
    await userModel.create(
      { name: 'Ana', email: 'ana@x.es', phone: '600111222', role: 'CLIENT' },
      { id: 'u1' },
    );

    // Empresa A: un edificio vivo con planta publicada y una en borrador, y lo eliminado.
    await mkBuilding('b-a', 'c-a', 'Edif A');
    await mkBuilding('b-borrado', 'c-a', 'Edif borrado', { deletedAt: new Date() });
    await mkFloor('f-a1', 'c-a', 'b-a', 1, 'PUBLISHED', { salas: [{ id: 'r-pub' }] });
    await mkFloor('f-a0', 'c-a', 'b-a', 0, 'DRAFT');
    await mkFloor('f-borrada', 'c-a', 'b-a', 5, 'DRAFT', { deletedAt: new Date() });
    await mkRoom('r-pub', 'c-a', 'b-a', 'f-a1', { price: 10, bookable: true });
    await mkRoom('r-oculta', 'c-a', 'b-a', 'f-a1', { price: 10, bookable: false, photos: [] });
    await mkRoom('r-sinprecio', 'c-a', 'b-a', 'f-a0', { bookable: false, photos: [] });
    await mkRoom('r-inactiva', 'c-a', 'b-a', 'f-a1', { status: 'INACTIVE', photos: [] });
    await mkRoom('r-borrada', 'c-a', 'b-a', 'f-a1', { photos: [], deletedAt: new Date() });

    // Empresa B: una sala publicada sin fotos y una reserva futura.
    await mkBuilding('b-b', 'c-b', 'Edif B', { status: 'PUBLISHED' });
    await mkFloor('f-b', 'c-b', 'b-b', 0, 'PUBLISHED', { salas: [{ id: 'r-b' }] });
    await mkRoom('r-b', 'c-b', 'b-b', 'f-b', { price: 5, bookable: true, photos: [] });
    await mkBooking('bk-b', 'c-b', 'r-b', inDays(1), 'CONFIRMED', 999);

    // Empresa solo con un edificio eliminado.
    await mkBuilding('b-d', 'c-del', 'Borrado', { deletedAt: new Date() });
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('permisos y validación', () => {
    it('401 sin token', async () => {
      assert.equal((await get()).status, 401);
    });

    it('403 FORBIDDEN con rol CLIENT y con rol ADMIN', async () => {
      for (const token of ['cliente', 'admin']) {
        const r = await get(undefined, token);
        assert.equal(r.status, 403);
        assert.equal(r.body.error.code, 'FORBIDDEN');
      }
    });

    it('403 COMPANY_NOT_APPROVED con empresa pendiente', async () => {
      const r = await get(undefined, 'pend');
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'COMPANY_NOT_APPROVED');
    });

    it('400 con parámetros desconocidos o con corchetes', async () => {
      for (const path of [
        '/api/company/summary?companyId=c-b',
        '/api/company/summary?x[]=1',
        '/api/company/summary?x[a]=1',
      ]) {
        const r = await get(path, 'a');
        assert.equal(r.status, 400, path);
        assert.equal(r.body.error.code, 'VALIDATION_ERROR', path);
      }
    });
  });

  describe('primerAcceso y aislamiento entre empresas', () => {
    it('primerAcceso true y todo a cero si la empresa no tiene edificios', async () => {
      const { status, body } = await get(undefined, 'nueva');
      assert.equal(status, 200);
      assert.equal(body.primerAcceso, true);
      assert.deepEqual(body.cifras, {
        edificios: 0,
        salasPublicadas: 0,
        reservasMes: 0,
        ingresosMes: 0,
      });
      assert.deepEqual(body.proximasReservas, []);
      assert.deepEqual(body.tareas.plantasSinPublicar, []);
      assert.deepEqual(body.tareas.salasSinPrecio, []);
      assert.deepEqual(body.tareas.salasSinFotos, []);
    });

    it('un edificio eliminado no quita el primerAcceso', async () => {
      const { body } = await get(undefined, 'soloDel');
      assert.equal(body.primerAcceso, true);
      assert.equal(body.cifras.edificios, 0);
    });

    it('primerAcceso false con edificios y cada empresa ve solo lo suyo', async () => {
      const a = (await get(undefined, 'a')).body;
      const b = (await get(undefined, 'b')).body;
      assert.equal(a.primerAcceso, false);
      assert.equal(a.cifras.edificios, 1);
      assert.equal(a.cifras.salasPublicadas, 1);
      assert.equal(b.primerAcceso, false);
      assert.equal(b.cifras.edificios, 1);
      assert.equal(b.cifras.salasPublicadas, 1);
      assert.deepEqual(
        b.proximasReservas.map((r) => r.id),
        ['bk-b'],
      );
      assert.equal(b.proximasReservas[0].importe, 999);
      assert.deepEqual(
        b.tareas.salasSinFotos.map((r) => r.id),
        ['r-b'],
      );
      assert.equal(b.tareas.plantasSinPublicar.length, 0);
      assert.equal(
        a.proximasReservas.some((r) => r.id === 'bk-b'),
        false,
      );
      assert.equal(
        a.tareas.salasSinFotos.some((r) => r.id === 'r-b'),
        false,
      );
      assert.equal(JSON.stringify(a).includes('r-b'), false);
    });
  });

  describe('cifras del mes', () => {
    it('por HTTP: cuenta CONFIRMED y COMPLETED del mes y deja fuera el resto', async () => {
      const { from, mes } = monthRange();
      await mkBooking(
        'mes-hecha',
        'c-a',
        'r-pub',
        new Date(from.getTime() + 36e5),
        'COMPLETED',
        40,
      );
      await mkBooking(
        'mes-cancelada',
        'c-a',
        'r-pub',
        new Date(from.getTime() + 36e5),
        'CANCELLED',
        99,
      );
      await mkBooking(
        'mes-expirada',
        'c-a',
        'r-pub',
        new Date(from.getTime() + 36e5),
        'EXPIRED',
        98,
      );
      await mkBooking(
        'mes-pend',
        'c-a',
        'r-pub',
        new Date(from.getTime() + 36e5),
        'PENDING_PAYMENT',
        97,
      );
      // Una reserva futura confirmada (mañana): cuenta solo si mañana sigue en este mes.
      await mkBooking('man', 'c-a', 'r-pub', inDays(1), 'CONFIRMED', 25.5);
      const enMes = addDays(todayString(), 1).startsWith(mes);
      const { body } = await get(undefined, 'a');
      assert.equal(body.mes, mes);
      assert.equal(body.cifras.reservasMes, enMes ? 2 : 1);
      assert.equal(body.cifras.ingresosMes, enMes ? 65.5 : 40);
    });

    it('borde del mes en Madrid: día 1 a las 8:00 y último día cuentan; el mes siguiente no', async () => {
      const now = new Date(2030, 2, 15, 12);
      await mkBooking('ini', 'c-a', 'r-pub', new Date(2030, 2, 1, 8), 'CONFIRMED', 50);
      await mkBooking('fin', 'c-a', 'r-pub', new Date(2030, 2, 31, 19), 'COMPLETED', 30.1);
      await mkBooking('sig', 'c-a', 'r-pub', new Date(2030, 3, 1, 8), 'CONFIRMED', 1000);
      await mkBooking('ant', 'c-a', 'r-pub', new Date(2030, 1, 28, 19), 'CONFIRMED', 2000);
      await mkBooking('canc', 'c-a', 'r-pub', new Date(2030, 2, 10, 9), 'CANCELLED', 5);
      await mkBooking('otra', 'c-b', 'r-b', new Date(2030, 2, 10, 9), 'CONFIRMED', 7);
      const r = await getSummary('c-a', { now });
      assert.equal(r.mes, '2030-03');
      assert.equal(r.cifras.reservasMes, 2);
      assert.equal(r.cifras.ingresosMes, 80.1);
      const b = await getSummary('c-b', { now });
      assert.equal(b.cifras.reservasMes, 1);
      assert.equal(b.cifras.ingresosMes, 7);
    });

    it('el resumen de otro mes usa su propio rango (enero y diciembre)', () => {
      assert.equal(monthRange(new Date(2030, 0, 31, 23)).mes, '2030-01');
      assert.equal(monthRange(new Date(2030, 11, 31, 23)).mes, '2030-12');
      assert.equal(monthRange(new Date(2030, 11, 31, 23)).to.getFullYear(), 2031);
    });

    it('las salas eliminadas o inactivas no cuentan como publicadas', async () => {
      await roomModel.update('r-pub', { deletedAt: new Date() });
      const { body } = await get(undefined, 'a');
      assert.equal(body.cifras.salasPublicadas, 0);
    });
  });

  describe('próximas reservas', () => {
    it('máximo 5, de la más cercana a la más lejana, sin userId ni teléfono', async () => {
      for (const d of [5, 2, 7, 1, 4, 6, 3]) {
        await mkBooking(`f${d}`, 'c-a', 'r-pub', inDays(d), 'CONFIRMED', 10 + d);
      }
      await mkBooking('canc', 'c-a', 'r-pub', inDays(1), 'CANCELLED', 1);
      await mkBooking('pasada', 'c-a', 'r-pub', inDays(-1), 'CONFIRMED', 1);
      const r = await get(undefined, 'a');
      assert.equal(r.status, 200);
      const lista = r.body.proximasReservas;
      assert.deepEqual(
        lista.map((x) => x.id),
        ['f1', 'f2', 'f3', 'f4', 'f5'],
      );
      assert.equal(lista[0].fecha, addDays(todayString(), 1));
      assert.equal(lista[0].inicio, 10);
      assert.equal(lista[0].fin, 12);
      assert.equal(lista[0].estado, 'CONFIRMED');
      assert.equal(lista[0].codigo, 'IP-f1');
      assert.equal(lista[0].importe, 11);
      assert.deepEqual(lista[0].sala, { nombre: 'Sala r-pub', codigo: 'R-PUB' });
      assert.deepEqual(lista[0].cliente, { nombre: 'Ana', email: 'ana@x.es' });
      assert.equal(r.text.includes('userId'), false);
      assert.equal(r.text.includes('600111222'), false);
      assert.equal(r.text.includes('u1'), false);
      // Cada próxima reserva y su cliente llevan solo los campos previstos.
      for (const item of lista) {
        assert.deepEqual(Object.keys(item).sort(), [
          'cliente',
          'codigo',
          'estado',
          'fecha',
          'fin',
          'id',
          'importe',
          'inicio',
          'sala',
        ]);
        assert.deepEqual(Object.keys(item.cliente).sort(), ['email', 'nombre']);
        assert.deepEqual(Object.keys(item.sala).sort(), ['codigo', 'nombre']);
      }
      for (const prohibido of ['userId', 'phone', 'telefono', 'companyId']) {
        assert.equal(r.text.includes(prohibido), false, prohibido);
      }
    });

    it('incluye PENDING_PAYMENT y no pone límite de días hacia delante', async () => {
      await mkBooking('pend', 'c-a', 'r-pub', inDays(2), 'PENDING_PAYMENT', 10);
      await mkBooking('lejos', 'c-a', 'r-pub', inDays(120), 'CONFIRMED', 10);
      await mkBooking('exp', 'c-a', 'r-pub', inDays(3), 'EXPIRED', 10);
      const { body } = await get(undefined, 'a');
      assert.deepEqual(
        body.proximasReservas.map((x) => [x.id, x.estado]),
        [
          ['pend', 'PENDING_PAYMENT'],
          ['lejos', 'CONFIRMED'],
        ],
      );
    });

    it('la respuesta se puede cachear solo en el navegador del usuario (30 s)', async () => {
      const r = await get(undefined, 'a');
      assert.equal(r.headers.get('cache-control'), 'private, max-age=30');
    });
  });

  describe('tareas pendientes', () => {
    it('plantas sin publicar, salas sin precio y sin fotos con sus ids (sin lo eliminado)', async () => {
      const { tareas } = (await get(undefined, 'a')).body;
      assert.deepEqual(tareas.plantasSinPublicar, [
        {
          id: 'f-a0',
          nombre: 'P0',
          numero: 0,
          buildingId: 'b-a',
          edificio: 'Edif A',
          sinMapa: true,
        },
      ]);
      assert.deepEqual(tareas.salasSinPrecio, [
        {
          id: 'r-sinprecio',
          nombre: 'Sala r-sinprecio',
          codigo: 'R-SINPRECIO',
          floorId: 'f-a0',
          buildingId: 'b-a',
        },
      ]);
      // Una sala sin precio y sin fotos sale en las dos listas (son dos tareas distintas).
      assert.deepEqual(
        tareas.salasSinFotos.map((r) => r.id),
        ['r-sinprecio', 'r-oculta'],
      );
      assert.deepEqual(tareas.salasSinFotos[1], {
        id: 'r-oculta',
        nombre: 'Sala r-oculta',
        codigo: 'R-OCULTA',
        floorId: 'f-a1',
        buildingId: 'b-a',
      });
      assert.deepEqual(tareas.totales, {
        plantasSinPublicar: 1,
        salasSinPrecio: 1,
        salasSinFotos: 2,
      });
    });

    it('una planta publicada con mapa no es tarea y sinMapa refleja si tiene salas', async () => {
      await floorModel.update('f-a0', { salas: [{ id: 'r-sinprecio' }] });
      const { tareas } = (await get(undefined, 'a')).body;
      assert.equal(tareas.plantasSinPublicar[0].sinMapa, false);
      await floorModel.update('f-a0', { status: 'PUBLISHED' });
      const otra = (await get(undefined, 'a')).body.tareas;
      assert.deepEqual(otra.plantasSinPublicar, []);
    });

    it('con más de 1000 salas lee solo 1000 y avisa con truncado: true', async () => {
      const normal = (await get(undefined, 'a')).body;
      assert.equal('truncado' in normal, false);
      for (let i = 0; i < 1001; i++) {
        await mkRoom(`m${i}`, 'c-a', 'b-a', 'f-a1', { price: 5, bookable: true });
      }
      const { body } = await get(undefined, 'a');
      assert.equal(body.truncado, true);
    });

    it('recorta cada lista a 50 y da el total real en `totales`', async () => {
      for (let i = 0; i < 55; i++) {
        await mkRoom(`x${String(i).padStart(2, '0')}`, 'c-a', 'b-a', 'f-a1', {
          bookable: false,
          photos: [],
        });
      }
      const { tareas } = (await get(undefined, 'a')).body;
      assert.equal(tareas.salasSinPrecio.length, 50);
      assert.equal(tareas.salasSinFotos.length, 50);
      assert.equal(tareas.totales.salasSinPrecio, 56);
      assert.equal(tareas.totales.salasSinFotos, 57);
    });
  });
});
