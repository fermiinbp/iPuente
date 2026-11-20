// Test de integración: reservas y bloqueos del panel de empresa (/api/company/bookings y /blocks),
// con el verificador de tokens y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as blockModel from '../../src/models/blockModel.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import * as userModel from '../../src/models/userModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  cliente: { uid: 'uc', role: 'CLIENT' },
};

const FECHA = '2030-03-12';
const FECHA2 = '2030-04-20';
const RANGO = 'desde=2030-01-01&hasta=2030-12-31';
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const AYER = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

describe('Panel de empresa: reservas y bloqueos', () => {
  let server;
  let baseUrl;

  async function call(method, path, { token = 'a', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  }

  const bloquear = (extra = {}, token) =>
    call('POST', '/api/company/blocks', {
      token,
      body: { roomId: 'r-a', fecha: FECHA, inicio: 10, fin: 12, motivo: 'Mantenimiento', ...extra },
    });

  const hourId = (roomId, fecha, h) => occupancyModel.slotId(roomId, fecha, h);

  // Crea una reserva con sus fichas de occupancy.
  async function seedBooking(
    id,
    { roomId = 'r-a', companyId = 'c-a', userId = 'u-cli', ...extra },
  ) {
    const { fecha = FECHA, inicio = 10, fin = 12, status = 'CONFIRMED' } = extra;
    const [y, m, d] = fecha.split('-').map(Number);
    await bookingModel.upsert(id, {
      userId,
      companyId,
      roomId,
      startDate: new Date(y, m - 1, d, inicio),
      endDate: new Date(y, m - 1, d, fin),
      price: 25,
      pricePeriod: 'HOUR',
      totalAmount: 25 * (fin - inicio),
      status,
    });
    if (status === 'CONFIRMED') {
      for (let h = inicio; h < fin; h++) {
        await occupancyModel.create(
          { companyId, roomId, date: fecha, hour: h, bookingId: id },
          { id: hourId(roomId, fecha, h) },
        );
      }
    }
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
    const sala = (companyId, name) => ({
      companyId,
      buildingId: 'b',
      floorId: 'f',
      name,
      code: name,
      type: 'sala',
      price: 25,
      pricePeriod: 'HOUR',
      bookable: true,
      status: 'ACTIVE',
    });
    await roomModel.upsert('r-a', sala('c-a', 'Sala A'));
    await roomModel.upsert('r-a2', sala('c-a', 'Sala A2'));
    await roomModel.upsert('r-b', sala('c-b', 'Sala B'));
    await userModel.upsert('u-cli', {
      name: 'Cliente Uno',
      email: 'cli@example.com',
      phone: '600123456',
      role: 'CLIENT',
    });
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('GET /api/company/bookings', () => {
    it('lista solo las reservas propias con el cliente y sin datos privados', async () => {
      await seedBooking('bk-a', {});
      await seedBooking('bk-b', { roomId: 'r-b', companyId: 'c-b' });
      const { status, body, text } = await call('GET', `/api/company/bookings?${RANGO}`);
      assert.equal(status, 200);
      assert.equal(body.reservas.length, 1);
      const r = body.reservas[0];
      assert.equal(r.id, 'bk-a');
      assert.equal(r.fecha, FECHA);
      assert.equal(r.inicio, 10);
      assert.equal(r.fin, 12);
      assert.equal(r.horas, 2);
      assert.equal(r.importe, 50);
      assert.equal(r.estado, 'CONFIRMED');
      assert.deepEqual(r.cliente, { nombre: 'Cliente Uno', email: 'cli@example.com' });
      assert.ok(!text.includes('u-cli'));
      assert.ok(!text.includes('600123456'));
      assert.ok(!text.includes('userId'));
    });

    it('filtra por desde, hasta y roomId', async () => {
      await seedBooking('bk-1', {});
      await seedBooking('bk-2', { fecha: FECHA2 });
      await seedBooking('bk-3', { roomId: 'r-a2', fecha: FECHA2, inicio: 14, fin: 15 });
      const ids = async (qs) =>
        (await call('GET', `/api/company/bookings${qs}`)).body.reservas.map((r) => r.id);
      assert.deepEqual(await ids('?desde=2030-04-01'), ['bk-2', 'bk-3']);
      assert.deepEqual(await ids('?desde=2030-03-01&hasta=2030-03-31'), ['bk-1']);
      assert.deepEqual(await ids(`?${RANGO}&roomId=r-a2`), ['bk-3']);
      assert.deepEqual(await ids('?desde=2030-03-12&hasta=2030-03-12'), ['bk-1']);
    });

    it('no devuelve reservas de salas ajenas aunque su companyId apunte a la empresa', async () => {
      await seedBooking('bk-mal', { roomId: 'r-b', companyId: 'c-a' });
      const { status, body, text } = await call('GET', `/api/company/bookings?${RANGO}`);
      assert.equal(status, 200);
      assert.deepEqual(body.reservas, []);
      assert.ok(!text.includes('cli@example.com'));
    });

    it('la respuesta no contiene la clave userId', async () => {
      await seedBooking('bk-a', {});
      const { body, text } = await call('GET', `/api/company/bookings?${RANGO}`);
      assert.equal(body.reservas.length, 1);
      assert.ok(!text.includes('userId'));
      assert.ok(!('userId' in body.reservas[0]));
    });

    it('sin filtros solo devuelve el rango por defecto (hoy - 30 días, +90 días)', async () => {
      const f = (n) => {
        const d = addDays(n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      await seedBooking('bk-dentro', { fecha: f(10) });
      await seedBooking('bk-pasada', { fecha: f(-60), status: 'CANCELLED' });
      await seedBooking('bk-lejana', { fecha: f(200) });
      const { body } = await call('GET', '/api/company/bookings');
      assert.deepEqual(
        body.reservas.map((r) => r.id),
        ['bk-dentro'],
      );
    });

    it('responde 400 con solo hasta lejano (rango efectivo mayor de 366 días o negativo)', async () => {
      for (const qs of ['?hasta=2030-01-01', '?hasta=2020-01-01']) {
        const res = await call('GET', `/api/company/bookings${qs}`);
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
        const bl = await call('GET', `/api/company/blocks${qs}`);
        assert.equal(bl.status, 400);
      }
    });

    it('responde 403 con roomId ajeno, 404 con inexistente y 400 con desde > hasta', async () => {
      const ajena = await call('GET', '/api/company/bookings?roomId=r-b');
      assert.equal(ajena.status, 403);
      const nada = await call('GET', '/api/company/bookings?roomId=no-existe');
      assert.equal(nada.status, 404);
      const rango = await call('GET', '/api/company/bookings?desde=2030-05-01&hasta=2030-04-01');
      assert.equal(rango.status, 400);
      assert.equal(rango.body.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/company/blocks', () => {
    it('crea el bloqueo y una ficha de occupancy por hora con el companyId del token', async () => {
      const { status, body } = await bloquear({ companyId: 'c-b' });
      assert.equal(status, 201);
      assert.equal(body.roomId, 'r-a');
      assert.equal(body.fecha, FECHA);
      assert.equal(body.inicio, 10);
      assert.equal(body.fin, 12);
      assert.equal(body.motivo, 'Mantenimiento');
      const block = await blockModel.findById(body.id);
      assert.equal(block.companyId, 'c-a');
      const fichas = await occupancyModel.listByRoomAndDate('r-a', FECHA);
      assert.deepEqual(
        fichas.map((f) => f.id).sort(),
        [hourId('r-a', FECHA, 10), hourId('r-a', FECHA, 11)].sort(),
      );
      for (const f of fichas) {
        assert.equal(f.blockId, body.id);
        assert.equal(f.companyId, 'c-a');
      }
    });

    it('responde 409 SLOT_TAKEN sobre una reserva CONFIRMED', async () => {
      await seedBooking('bk-a', {});
      const { status, body } = await bloquear({ inicio: 11, fin: 13 });
      assert.equal(status, 409);
      assert.equal(body.error.code, 'SLOT_TAKEN');
    });

    it('responde 409 sobre otro bloqueo', async () => {
      await bloquear();
      const { status, body } = await bloquear({ inicio: 11, fin: 13 });
      assert.equal(status, 409);
      assert.equal(body.error.code, 'SLOT_TAKEN');
    });

    it('permite bloquear sobre una reserva CANCELLED', async () => {
      await seedBooking('bk-c', { status: 'CANCELLED' });
      const { status } = await bloquear();
      assert.equal(status, 201);
    });

    it('responde 403 en sala ajena sin crear nada', async () => {
      const { status } = await bloquear({ roomId: 'r-b' });
      assert.equal(status, 403);
      assert.deepEqual(await occupancyModel.listByRoomAndDate('r-b', FECHA), []);
      assert.deepEqual(await blockModel.listByCompany('c-b'), []);
    });

    it('responde 404 en sala inexistente', async () => {
      const { status } = await bloquear({ roomId: 'no-existe' });
      assert.equal(status, 404);
    });

    it('responde 400 OUT_OF_HOURS fuera de 8-20', async () => {
      for (const extra of [
        { inicio: 7, fin: 9 },
        { inicio: 19, fin: 21 },
      ]) {
        const { status, body } = await bloquear(extra);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'OUT_OF_HOURS');
      }
    });

    for (const [titulo, extra] of [
      ['inicio mayor o igual que fin', { inicio: 12, fin: 12 }],
      ['fecha pasada', { fecha: AYER }],
      ['sin motivo', { motivo: undefined }],
      ['motivo vacío', { motivo: '   ' }],
    ]) {
      it(`responde 400 VALIDATION_ERROR con ${titulo}`, async () => {
        const { status, body } = await bloquear(extra);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      });
    }
  });

  describe('GET y DELETE /api/company/blocks', () => {
    it('lista solo los bloqueos propios', async () => {
      await bloquear();
      await blockModel.upsert('bl-b', {
        companyId: 'c-b',
        roomId: 'r-b',
        startDate: new Date(2030, 2, 12, 10),
        endDate: new Date(2030, 2, 12, 12),
        reason: 'Ajeno',
      });
      const { status, body } = await call('GET', `/api/company/blocks?${RANGO}`);
      assert.equal(status, 200);
      assert.equal(body.bloqueos.length, 1);
      assert.equal(body.bloqueos[0].roomId, 'r-a');
      assert.equal(body.bloqueos[0].motivo, 'Mantenimiento');
    });

    it('borra un bloqueo propio y libera las horas', async () => {
      const { body: creado } = await bloquear();
      const { status, body } = await call('DELETE', `/api/company/blocks/${creado.id}`);
      assert.equal(status, 200);
      assert.deepEqual(body, { id: creado.id, borrado: true });
      assert.equal(await blockModel.findById(creado.id), null);
      assert.deepEqual(await occupancyModel.listByRoomAndDate('r-a', FECHA), []);
      assert.equal((await bloquear()).status, 201);
    });

    it('no lista bloqueos de salas ajenas aunque su companyId apunte a la empresa', async () => {
      await blockModel.upsert('bl-mal', {
        companyId: 'c-a',
        roomId: 'r-b',
        startDate: new Date(2030, 2, 12, 10),
        endDate: new Date(2030, 2, 12, 12),
        reason: 'Mal',
      });
      const { body } = await call('GET', `/api/company/blocks?${RANGO}`);
      assert.deepEqual(body.bloqueos, []);
    });

    it('no borra fichas de occupancy de otra reserva al borrar el bloqueo', async () => {
      const { body: creado } = await bloquear();
      const ajena = hourId('r-a', FECHA, 10);
      await occupancyModel.remove(ajena);
      await occupancyModel.create(
        { companyId: 'c-a', roomId: 'r-a', date: FECHA, hour: 10, bookingId: 'otra' },
        { id: ajena },
      );
      const { status } = await call('DELETE', `/api/company/blocks/${creado.id}`);
      assert.equal(status, 200);
      const fichas = await occupancyModel.listByRoomAndDate('r-a', FECHA);
      assert.deepEqual(
        fichas.map((f) => [f.id, f.bookingId]),
        [[ajena, 'otra']],
      );
    });

    it('responde 403 al borrar un bloqueo ajeno sin borrarlo', async () => {
      await blockModel.upsert('bl-b', {
        companyId: 'c-b',
        roomId: 'r-b',
        startDate: new Date(2030, 2, 12, 10),
        endDate: new Date(2030, 2, 12, 12),
        reason: 'Ajeno',
      });
      const { status } = await call('DELETE', '/api/company/blocks/bl-b');
      assert.equal(status, 403);
      assert.ok(await blockModel.findById('bl-b'));
    });

    it('responde 404 al borrar un bloqueo inexistente', async () => {
      const { status } = await call('DELETE', '/api/company/blocks/no-existe');
      assert.equal(status, 404);
    });
  });

  describe('GET /api/company/bookings/:id', () => {
    const detalle = (id, token) => call('GET', `/api/company/bookings/${id}`, { token });

    it('devuelve la reserva propia con sala, planta, edificio y cliente', async () => {
      await buildingModel.upsert('b', { name: 'Edificio', address: 'Calle 1', city: 'Sevilla' });
      await floorModel.upsert('f', { name: 'Planta baja', level: 0 });
      await seedBooking('bk-a', {});
      await bookingModel.update('bk-a', { code: 'IP-1000' });
      const { status, body, text } = await detalle('bk-a');
      assert.equal(status, 200);
      assert.equal(body.id, 'bk-a');
      assert.equal(body.codigo, 'IP-1000');
      assert.deepEqual(body.sala, { id: 'r-a', codigo: 'Sala A', nombre: 'Sala A' });
      assert.deepEqual(body.planta, { id: 'f', nombre: 'Planta baja', nivel: 0 });
      assert.deepEqual(body.edificio, {
        id: 'b',
        nombre: 'Edificio',
        direccion: 'Calle 1',
        ciudad: 'Sevilla',
      });
      assert.equal(body.fecha, FECHA);
      assert.equal(body.inicio, 10);
      assert.equal(body.fin, 12);
      assert.equal(body.importe, 50);
      assert.equal(body.estado, 'CONFIRMED');
      assert.deepEqual(body.cliente, { nombre: 'Cliente Uno', email: 'cli@example.com' });
      assert.ok(!text.includes('u-cli'));
      assert.ok(!text.includes('600123456'));
      assert.ok(!text.includes('userId'));
      assert.ok(!text.includes('companyId'));
    });

    it('responde 403 si la reserva es de otra empresa', async () => {
      await seedBooking('bk-b', { roomId: 'r-b', companyId: 'c-b' });
      const { status, body } = await detalle('bk-b');
      assert.equal(status, 403);
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    it('responde 404 si no existe y 400 si el id no es válido', async () => {
      assert.equal((await detalle('no-existe')).status, 404);
      assert.equal((await detalle('a.b')).status, 400);
    });

    it('responde 401 sin token, 403 a un cliente y COMPANY_NOT_APPROVED a una pendiente', async () => {
      await seedBooking('bk-a', {});
      assert.equal((await detalle('bk-a', null)).status, 401);
      const cli = await detalle('bk-a', 'cliente');
      assert.equal(cli.status, 403);
      assert.equal(cli.body.error.code, 'FORBIDDEN');
      const pend = await detalle('bk-a', 'pend');
      assert.equal(pend.status, 403);
      assert.equal(pend.body.error.code, 'COMPANY_NOT_APPROVED');
    });

    it('si la cancela la empresa devuelve canceladaPor empresa y el motivo', async () => {
      await seedBooking('bk-a', {});
      await call('PATCH', '/api/company/bookings/bk-a/cancel', { body: { motivo: 'Obras' } });
      const { body } = await detalle('bk-a');
      assert.equal(body.estado, 'CANCELLED');
      assert.equal(body.canceladaPor, 'empresa');
      assert.equal(body.motivoCancelacion, 'Obras');
    });

    it('sigue viéndose aunque la sala ya no exista', async () => {
      await seedBooking('bk-a', {});
      await roomModel.remove('r-a');
      const { status, body } = await detalle('bk-a');
      assert.equal(status, 200);
      assert.equal(body.sala, null);
    });
  });

  describe('PATCH /api/company/bookings/:id/cancel', () => {
    const cancelar = (id, body, token) =>
      call('PATCH', `/api/company/bookings/${id}/cancel`, { token, body });

    it('cancela la reserva propia, guarda el motivo y libera las horas', async () => {
      await seedBooking('bk-a', {});
      const { status, body } = await cancelar('bk-a', { motivo: 'Obras' });
      assert.equal(status, 200);
      assert.deepEqual(body, { id: 'bk-a', estado: 'CANCELLED', motivo: 'Obras' });
      const guardada = await bookingModel.findById('bk-a');
      assert.equal(guardada.status, 'CANCELLED');
      assert.equal(guardada.cancelledBy, 'COMPANY');
      assert.equal(guardada.cancelReason, 'Obras');
      assert.deepEqual(await occupancyModel.listByRoomAndDate('r-a', FECHA), []);
    });

    it('responde 400 VALIDATION_ERROR sin motivo o con motivo vacío', async () => {
      await seedBooking('bk-a', {});
      for (const data of [{}, { motivo: '' }, { motivo: '   ' }]) {
        const { status, body } = await cancelar('bk-a', data);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      }
      assert.equal((await bookingModel.findById('bk-a')).status, 'CONFIRMED');
    });

    it('no borra fichas de occupancy de otro bloqueo al cancelar', async () => {
      await seedBooking('bk-a', {});
      const ajena = hourId('r-a', FECHA, 10);
      await occupancyModel.remove(ajena);
      await occupancyModel.create(
        { companyId: 'c-a', roomId: 'r-a', date: FECHA, hour: 10, blockId: 'otro' },
        { id: ajena },
      );
      const { status } = await cancelar('bk-a', { motivo: 'x' });
      assert.equal(status, 200);
      const fichas = await occupancyModel.listByRoomAndDate('r-a', FECHA);
      assert.deepEqual(
        fichas.map((f) => f.id),
        [ajena],
      );
    });

    it('responde 403 con una reserva de otra empresa sin cambiarla', async () => {
      await seedBooking('bk-b', { roomId: 'r-b', companyId: 'c-b' });
      const { status } = await cancelar('bk-b', { motivo: 'x' });
      assert.equal(status, 403);
      assert.equal((await bookingModel.findById('bk-b')).status, 'CONFIRMED');
      assert.equal((await occupancyModel.listByRoomAndDate('r-b', FECHA)).length, 2);
    });

    it('responde 404 si no existe', async () => {
      const { status } = await cancelar('no-existe', { motivo: 'x' });
      assert.equal(status, 404);
    });

    it('responde 400 BOOKING_NOT_CANCELLABLE si ya estaba cancelada', async () => {
      await seedBooking('bk-c', { status: 'CANCELLED' });
      const { status, body } = await cancelar('bk-c', { motivo: 'x' });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'BOOKING_NOT_CANCELLABLE');
    });

    it('responde 400 BOOKING_STARTED si ya ha empezado', async () => {
      await seedBooking('bk-p', { fecha: '2020-01-10', inicio: 9, fin: 11 });
      const { status, body } = await cancelar('bk-p', { motivo: 'x' });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'BOOKING_STARTED');
    });
  });

  describe('permisos', () => {
    const endpoints = [
      ['GET', '/api/company/bookings', undefined],
      [
        'POST',
        '/api/company/blocks',
        { roomId: 'r-a', fecha: FECHA, inicio: 10, fin: 12, motivo: 'x' },
      ],
      ['GET', '/api/company/blocks', undefined],
      ['DELETE', '/api/company/blocks/bl-1', undefined],
      ['PATCH', '/api/company/bookings/bk-1/cancel', { motivo: 'x' }],
    ];
    for (const [method, path, body] of endpoints) {
      it(`${method} ${path}: 401 sin token, 403 con cliente y 403 con empresa pendiente`, async () => {
        const sin = await call(method, path, { token: null, body });
        assert.equal(sin.status, 401);
        const cliente = await call(method, path, { token: 'cliente', body });
        assert.equal(cliente.status, 403);
        assert.equal(cliente.body.error.code, 'FORBIDDEN');
        const pend = await call(method, path, { token: 'pend', body });
        assert.equal(pend.status, 403);
        assert.equal(pend.body.error.code, 'COMPANY_NOT_APPROVED');
      });
    }
  });
});
