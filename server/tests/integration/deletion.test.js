// Test de integración de eliminar edificios, plantas y salas (DELETE /api/company/buildings|floors|rooms/:id)
// y de GET /api/company/rooms/:id/future-bookings, con token y Firestore sustituidos por dobles.
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
import { addDays, todayString } from '../../src/utils/dates.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const tokens = {
  a: { uid: 'ua', role: 'COMPANY', companyId: 'c-a' },
  b: { uid: 'ub', role: 'COMPANY', companyId: 'c-b' },
  pend: { uid: 'up', role: 'COMPANY', companyId: 'c-pend' },
  cliente: { uid: 'u-cli', role: 'CLIENT' },
  admin: { uid: 'admin-1', role: 'ADMIN' },
};

const hoy = todayString();
const FUTURO = addDays(hoy, 5);
const FUTURO2 = addDays(hoy, 6);
const PASADO = addDays(hoy, -10);

// Fecha AAAA-MM-DD y hora a Date local.
const at = (fecha, hour) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

describe('Eliminar edificio, planta o sala', () => {
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
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text };
  }
  const del = (path, token = 'a') => call('DELETE', path, { token });

  const mkBooking = (id, roomId, fecha, status = 'CONFIRMED') =>
    bookingModel.create(
      {
        code: `IP-${id}`,
        userId: 'u-cli',
        companyId: 'c-a',
        roomId,
        startDate: at(fecha, 10),
        endDate: at(fecha, 12),
        price: 10,
        pricePeriod: 'HOUR',
        totalAmount: 20,
        status,
      },
      { id },
    );

  const mkFloor = (id, buildingId, level, status, salas, companyId = 'c-a') =>
    floorModel.create(
      {
        companyId,
        buildingId,
        name: `Planta ${level}`,
        level,
        status,
        ancho: 1000,
        alto: 600,
        origen: 'manual',
        salas: salas.map((s) => ({
          id: s,
          codigo: s.toUpperCase(),
          nombre: `Sala ${s}`,
          tipo: 'sala',
          x: 0,
          y: 0,
          w: 10,
          h: 10,
        })),
      },
      { id },
    );

  const mkRoom = (id, buildingId, floorId, companyId = 'c-a') =>
    roomModel.create(
      {
        companyId,
        buildingId,
        floorId,
        name: `Sala ${id}`,
        code: id.toUpperCase(),
        type: 'sala',
        price: 10,
        pricePeriod: 'HOUR',
        capacity: 4,
        amenities: [],
        photos: [],
        bookable: true,
        status: 'ACTIVE',
      },
      { id },
    );

  const exists = async (model, id) => Boolean(await model.findById(id));

  // Un bloqueo de 14 a 16 con sus fichas de occupancy.
  async function mkBlock(id, roomId, fecha) {
    await blockModel.create(
      {
        companyId: 'c-a',
        roomId,
        startDate: at(fecha, 14),
        endDate: at(fecha, 16),
        reason: 'Mantenimiento',
      },
      { id },
    );
    for (const hour of [14, 15]) {
      await occupancyModel.create(
        { companyId: 'c-a', roomId, date: fecha, hour, blockId: id },
        { id: occupancyModel.slotId(roomId, fecha, hour) },
      );
    }
  }

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  // Datos:
  //  b1 (PUBLISHED, c-a): f1 (PUBLISHED, nivel 1: r1 con reserva pasada, r2) y f2 (DRAFT, nivel 2: r3)
  //  b2 (DRAFT, c-a): f3 (DRAFT, nivel 0: r4, r5), sin reservas
  //  b-b (c-b): f-b con r-b
  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await companyModel.create({ name: 'A', status: 'APPROVED', verified: true }, { id: 'c-a' });
    await companyModel.create({ name: 'B', status: 'APPROVED', verified: true }, { id: 'c-b' });
    await companyModel.create({ name: 'P', status: 'PENDING', verified: false }, { id: 'c-pend' });
    await userModel.create(
      { name: 'Ana', surname: 'Ruiz', email: 'ana@x.com', role: 'CLIENT' },
      { id: 'u-cli' },
    );
    const b = (companyId, name, status) => ({
      companyId,
      name,
      address: 'Calle 1',
      city: 'Sevilla',
      status,
    });
    await buildingModel.create(b('c-a', 'Edif 1', 'PUBLISHED'), { id: 'b1' });
    await buildingModel.create(b('c-a', 'Edif 2', 'DRAFT'), { id: 'b2' });
    await buildingModel.create(b('c-b', 'Edif B', 'PUBLISHED'), { id: 'b-b' });
    await mkFloor('f1', 'b1', 1, 'PUBLISHED', ['r1', 'r2']);
    await mkFloor('f2', 'b1', 2, 'DRAFT', ['r3']);
    await mkFloor('f3', 'b2', 0, 'DRAFT', ['r4', 'r5']);
    await mkFloor('f-b', 'b-b', 0, 'PUBLISHED', ['r-b'], 'c-b');
    await mkRoom('r1', 'b1', 'f1');
    await mkRoom('r2', 'b1', 'f1');
    await mkRoom('r3', 'b1', 'f2');
    await mkRoom('r4', 'b2', 'f3');
    await mkRoom('r5', 'b2', 'f3');
    await mkRoom('r-b', 'b-b', 'f-b', 'c-b');
    await mkBooking('bk-old', 'r1', PASADO);
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('permisos', () => {
    const endpoints = [
      ['DELETE', '/api/company/buildings/b2'],
      ['DELETE', '/api/company/floors/f3'],
      ['DELETE', '/api/company/rooms/r4'],
      ['GET', '/api/company/rooms/r4/future-bookings'],
    ];
    for (const [method, path] of endpoints) {
      it(`${method} ${path}: 401 sin token`, async () => {
        assert.equal((await call(method, path)).status, 401);
      });
      it(`${method} ${path}: 403 FORBIDDEN con rol CLIENT`, async () => {
        const r = await call(method, path, { token: 'cliente' });
        assert.equal(r.status, 403);
        assert.equal(r.body.error.code, 'FORBIDDEN');
      });
      it(`${method} ${path}: 403 COMPANY_NOT_APPROVED con empresa pendiente`, async () => {
        const r = await call(method, path, { token: 'pend' });
        assert.equal(r.status, 403);
        assert.equal(r.body.error.code, 'COMPANY_NOT_APPROVED');
      });
      it(`${method} ${path}: 404 con un recurso de otra empresa y no lo toca`, async () => {
        const r = await call(method, path, { token: 'b' });
        assert.equal(r.status, 404);
        assert.equal(r.body.error.code, 'NOT_FOUND');
        assert.equal(await exists(roomModel, 'r4'), true);
        assert.equal(await exists(floorModel, 'f3'), true);
        assert.equal(await exists(buildingModel, 'b2'), true);
      });
    }
    it('404 si no existe y 400 si el id no es válido', async () => {
      for (const kind of ['buildings', 'floors', 'rooms']) {
        assert.equal((await del(`/api/company/${kind}/no-existe`)).status, 404);
        assert.equal((await del(`/api/company/${kind}/a.b`)).status, 400);
      }
      assert.equal(
        (await call('GET', '/api/company/rooms/x.y/future-bookings', { token: 'a' })).status,
        400,
      );
    });
  });

  describe('DELETE /company/rooms/:id', () => {
    it('200: sala sin reservas se borra, se quita del mapa y se llevan sus bloqueos', async () => {
      await mkBlock('bl-1', 'r2', FUTURO);
      const r = await del('/api/company/rooms/r2');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, {
        id: 'r2',
        eliminado: true,
        borradoLogico: false,
        plantasEliminadas: 0,
        salasEliminadas: 1,
        salasDesactivadas: 0,
        bloqueosEliminados: 1,
      });
      assert.equal(await exists(roomModel, 'r2'), false);
      assert.equal(await exists(blockModel, 'bl-1'), false);
      assert.equal(await exists(occupancyModel, occupancyModel.slotId('r2', FUTURO, 14)), false);
      assert.deepEqual(
        (await floorModel.findById('f1')).salas.map((s) => s.id),
        ['r1'],
      );
    });

    it('200: sala con historial (reserva pasada) se elimina de forma lógica', async () => {
      const r = await del('/api/company/rooms/r1');
      assert.equal(r.status, 200);
      assert.equal(r.body.borradoLogico, true);
      assert.equal(r.body.salasEliminadas, 0);
      assert.equal(r.body.salasDesactivadas, 1);
      const room = await roomModel.findById('r1');
      assert.equal(room.status, 'INACTIVE');
      assert.equal(room.bookable, false);
      assert.ok(room.deletedAt);
      assert.deepEqual(
        (await floorModel.findById('f1')).salas.map((s) => s.id),
        ['r2'],
      );
      assert.equal(await exists(bookingModel, 'bk-old'), true);
    });

    it('200: una reserva cancelada también cuenta como historial', async () => {
      await mkBooking('bk-c', 'r2', FUTURO, 'CANCELLED');
      const r = await del('/api/company/rooms/r2');
      assert.equal(r.status, 200);
      assert.equal(r.body.borradoLogico, true);
      assert.ok((await roomModel.findById('r2')).deletedAt);
    });

    it('409 HAS_FUTURE_BOOKINGS con una reserva CONFIRMED y no cambia nada', async () => {
      await mkBooking('bk-f', 'r2', FUTURO);
      const r = await del('/api/company/rooms/r2');
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'HAS_FUTURE_BOOKINGS');
      assert.deepEqual(r.body.error.details, { reservasFuturas: 1 });
      assert.equal(await exists(roomModel, 'r2'), true);
      assert.equal((await bookingModel.findById('bk-f')).status, 'CONFIRMED');
      assert.equal((await floorModel.findById('f1')).salas.length, 2);
    });

    it('409 con una reserva PENDING_PAYMENT', async () => {
      await mkBooking('bk-p', 'r2', FUTURO, 'PENDING_PAYMENT');
      const r = await del('/api/company/rooms/r2');
      assert.equal(r.status, 409);
      assert.equal(r.body.error.details.reservasFuturas, 1);
    });

    it('las reservas canceladas, caducadas o pasadas no bloquean', async () => {
      await mkBooking('bk-1', 'r2', FUTURO, 'CANCELLED');
      await mkBooking('bk-2', 'r2', FUTURO2, 'EXPIRED');
      await mkBooking('bk-3', 'r2', PASADO, 'COMPLETED');
      assert.equal((await del('/api/company/rooms/r2')).status, 200);
    });

    it('404 si la sala ya estaba eliminada', async () => {
      assert.equal((await del('/api/company/rooms/r1')).status, 200);
      assert.equal((await del('/api/company/rooms/r1')).status, 404);
    });

    it('aviso si la planta publicada se queda sin salas reservables', async () => {
      assert.equal((await del('/api/company/rooms/r2')).body.aviso, undefined);
      const r = await del('/api/company/rooms/r1');
      assert.match(r.body.aviso, /planta sigue publicada/);
    });

    it('una sala eliminada no se puede editar, mostrar, bloquear ni listar', async () => {
      await del('/api/company/rooms/r1');
      const patch = await call('PATCH', '/api/company/rooms/r1', {
        token: 'a',
        body: { nombre: 'Otra' },
      });
      assert.equal(patch.status, 404);
      const vis = await call('PATCH', '/api/company/rooms/r1/visibility', {
        token: 'a',
        body: { visible: true },
      });
      assert.equal(vis.status, 404);
      const block = await call('POST', '/api/company/blocks', {
        token: 'a',
        body: { roomId: 'r1', fecha: FUTURO, inicio: 14, fin: 16, motivo: 'x' },
      });
      assert.equal(block.status, 404);
      const list = await call('GET', '/api/company/rooms', { token: 'a' });
      assert.equal(
        list.body.some((s) => s.id === 'r1'),
        false,
      );
    });
  });

  describe('DELETE /company/floors/:id', () => {
    it('200: planta sin reservas se borra con sus salas y bloqueos', async () => {
      await mkBlock('bl-3', 'r3', FUTURO);
      const r = await del('/api/company/floors/f2');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, {
        id: 'f2',
        eliminado: true,
        borradoLogico: false,
        plantasEliminadas: 1,
        salasEliminadas: 1,
        salasDesactivadas: 0,
        bloqueosEliminados: 1,
      });
      assert.equal(await exists(floorModel, 'f2'), false);
      assert.equal(await exists(roomModel, 'r3'), false);
      assert.equal(await exists(blockModel, 'bl-3'), false);
      assert.equal(await exists(occupancyModel, occupancyModel.slotId('r3', FUTURO, 15)), false);
      assert.equal(await exists(buildingModel, 'b1'), true);
    });

    it('200: con historial en alguna sala, la planta se elimina de forma lógica', async () => {
      const r = await del('/api/company/floors/f1');
      assert.equal(r.status, 200);
      assert.equal(r.body.borradoLogico, true);
      assert.equal(r.body.plantasEliminadas, 1);
      assert.equal(r.body.salasEliminadas, 1); // r2, sin historial
      assert.equal(r.body.salasDesactivadas, 1); // r1, con historial
      const floor = await floorModel.findById('f1');
      assert.ok(floor.deletedAt);
      assert.equal(floor.status, 'DRAFT');
      assert.equal(floor.salas.length, 2); // el mapa se conserva
      assert.equal(await exists(roomModel, 'r2'), false);
      assert.ok((await roomModel.findById('r1')).deletedAt);
      assert.match(r.body.aviso, /edificio sigue publicado/);
    });

    it('409 con reservas futuras en cualquiera de sus salas', async () => {
      await mkBooking('bk-f1', 'r1', FUTURO);
      await mkBooking('bk-f2', 'r2', FUTURO2, 'PENDING_PAYMENT');
      const r = await del('/api/company/floors/f1');
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'HAS_FUTURE_BOOKINGS');
      assert.equal(r.body.error.details.reservasFuturas, 2);
      assert.equal(await exists(floorModel, 'f1'), true);
      assert.equal(await exists(roomModel, 'r2'), true);
    });

    it('404 si ya estaba eliminada y no se puede editar ni publicar ni guardar su mapa', async () => {
      await del('/api/company/floors/f1');
      assert.equal((await del('/api/company/floors/f1')).status, 404);
      const patch = await call('PATCH', '/api/company/floors/f1', {
        token: 'a',
        body: { nombre: 'X' },
      });
      assert.equal(patch.status, 404);
      assert.equal(
        (await call('POST', '/api/company/floors/f1/publish', { token: 'a' })).status,
        404,
      );
      const map = await call('PUT', '/api/company/floors/f1/map', {
        token: 'a',
        body: { ancho: 100, alto: 100, origen: 'manual', salas: [] },
      });
      assert.equal(map.status, 404);
    });

    it('su número queda libre: se puede crear otra planta con el mismo número', async () => {
      const dup = await call('POST', '/api/company/buildings/b1/floors', {
        token: 'a',
        body: { numero: 1, nombre: 'Otra' },
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, 'FLOOR_EXISTS');
      await del('/api/company/floors/f1');
      const ok = await call('POST', '/api/company/buildings/b1/floors', {
        token: 'a',
        body: { numero: 1, nombre: 'Nueva' },
      });
      assert.equal(ok.status, 201);
    });
  });

  describe('DELETE /company/buildings/:id', () => {
    it('200: edificio sin reservas se borra en cascada', async () => {
      await mkBlock('bl-4', 'r4', FUTURO);
      const r = await del('/api/company/buildings/b2');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, {
        id: 'b2',
        eliminado: true,
        borradoLogico: false,
        plantasEliminadas: 1,
        salasEliminadas: 2,
        salasDesactivadas: 0,
        bloqueosEliminados: 1,
      });
      assert.equal(await exists(buildingModel, 'b2'), false);
      assert.equal(await exists(floorModel, 'f3'), false);
      assert.equal(await exists(roomModel, 'r4'), false);
      assert.equal(await exists(roomModel, 'r5'), false);
      assert.equal(await exists(blockModel, 'bl-4'), false);
      assert.equal(await exists(occupancyModel, occupancyModel.slotId('r4', FUTURO, 14)), false);
      // Lo de otra empresa no se toca.
      assert.equal(await exists(buildingModel, 'b-b'), true);
      assert.equal(await exists(roomModel, 'r-b'), true);
    });

    it('200: con historial, el edificio y su planta se eliminan de forma lógica', async () => {
      const r = await del('/api/company/buildings/b1');
      assert.equal(r.status, 200);
      assert.equal(r.body.borradoLogico, true);
      assert.equal(r.body.plantasEliminadas, 2);
      assert.equal(r.body.salasEliminadas, 2); // r2 y r3
      assert.equal(r.body.salasDesactivadas, 1); // r1
      const building = await buildingModel.findById('b1');
      assert.ok(building.deletedAt);
      assert.equal(building.status, 'DRAFT');
      assert.ok((await floorModel.findById('f1')).deletedAt);
      assert.equal(await exists(floorModel, 'f2'), false); // sin historial: borrada del todo
      assert.ok((await roomModel.findById('r1')).deletedAt);
      assert.equal(await exists(bookingModel, 'bk-old'), true);
    });

    it('409 con reservas futuras en una sala de cualquier planta', async () => {
      await mkBooking('bk-f', 'r3', FUTURO);
      const r = await del('/api/company/buildings/b1');
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'HAS_FUTURE_BOOKINGS');
      assert.deepEqual(r.body.error.details, { reservasFuturas: 1 });
      assert.equal(await exists(buildingModel, 'b1'), true);
      assert.equal(await exists(roomModel, 'r3'), true);
    });

    it('404 si ya estaba eliminado y no se puede editar, publicar ni añadirle plantas', async () => {
      await del('/api/company/buildings/b1');
      assert.equal((await del('/api/company/buildings/b1')).status, 404);
      const patch = await call('PATCH', '/api/company/buildings/b1', {
        token: 'a',
        body: { nombre: 'X' },
      });
      assert.equal(patch.status, 404);
      assert.equal(
        (await call('POST', '/api/company/buildings/b1/publish', { token: 'a' })).status,
        404,
      );
      const floor = await call('POST', '/api/company/buildings/b1/floors', {
        token: 'a',
        body: { numero: 5, nombre: 'Nueva' },
      });
      assert.equal(floor.status, 404);
    });
  });

  describe('lo eliminado desaparece de listados y de la API pública', () => {
    it('el listado de edificios y de salas de la empresa no muestra lo eliminado', async () => {
      await del('/api/company/rooms/r1');
      await del('/api/company/floors/f2');
      await del('/api/company/buildings/b2');
      const list = await call('GET', '/api/company/buildings', { token: 'a' });
      assert.deepEqual(
        list.body.map((b) => b.id),
        ['b1'],
      );
      assert.deepEqual(
        list.body[0].plantas.map((p) => p.id),
        ['f1'],
      );
      assert.equal(list.body[0].plantas[0].salas, 1);
      const rooms = await call('GET', '/api/company/rooms', { token: 'a' });
      assert.deepEqual(
        rooms.body.map((s) => s.id),
        ['r2'],
      );
      await del('/api/company/buildings/b1');
      assert.deepEqual((await call('GET', '/api/company/buildings', { token: 'a' })).body, []);
    });

    it('el admin no ve los edificios eliminados de la empresa', async () => {
      await del('/api/company/buildings/b1');
      const r = await call('GET', '/api/admin/companies/c-a', { token: 'admin' });
      assert.equal(r.status, 200);
      assert.deepEqual(
        r.body.edificios.map((b) => b.id),
        ['b2'],
      );
    });

    it('la API pública responde 404 tras eliminar un edificio, una planta o una sala', async () => {
      await roomModel.update('r2', { price: 10, bookable: true });
      const pub = async (path) => (await call('GET', path)).status;
      assert.equal(await pub('/api/buildings/b1'), 200);
      assert.equal(await pub('/api/floors/f1'), 200);
      assert.equal(await pub('/api/rooms/r2'), 200);

      assert.equal((await del('/api/company/rooms/r2')).status, 200);
      assert.equal(await pub('/api/rooms/r2'), 404);
      assert.equal(await pub(`/api/rooms/r2/availability?fecha=${FUTURO}`), 404);
      const book = await call('POST', '/api/bookings', {
        token: 'cliente',
        body: { roomId: 'r2', fecha: FUTURO, inicio: 10, fin: 12 },
      });
      assert.equal(book.status, 404);

      // r1 (con historial) deja de verse y de reservarse aunque su documento siga existiendo.
      assert.equal((await del('/api/company/rooms/r1')).status, 200);
      assert.equal(await pub('/api/rooms/r1'), 404);
      const book1 = await call('POST', '/api/bookings', {
        token: 'cliente',
        body: { roomId: 'r1', fecha: FUTURO, inicio: 10, fin: 12 },
      });
      assert.equal(book1.status, 404);

      assert.equal((await del('/api/company/floors/f1')).status, 200);
      assert.equal(await pub('/api/floors/f1'), 404);
      const building = await call('GET', '/api/buildings/b1');
      assert.equal(building.status, 200);
      assert.equal(
        building.body.plantas.some((p) => p.id === 'f1'),
        false,
      );

      assert.equal((await del('/api/company/buildings/b1')).status, 200);
      assert.equal(await pub('/api/buildings/b1'), 404);
      const search = await call('GET', '/api/buildings');
      assert.equal(
        search.body.edificios.some((e) => e.id === 'b1'),
        false,
      );
    });

    it('una sala eliminada lógicamente no sale aunque la planta o el edificio sigan publicados', async () => {
      // Una planta publicada con un documento de sala marcado como eliminado pero aún reservable.
      await roomModel.update('r2', { deletedAt: new Date() });
      assert.equal((await call('GET', '/api/rooms/r2')).status, 404);
      const book = await call('POST', '/api/bookings', {
        token: 'cliente',
        body: { roomId: 'r2', fecha: FUTURO, inicio: 10, fin: 12 },
      });
      assert.equal(book.status, 404);
    });
  });

  describe('mapas', () => {
    it('reintroducir en el mapa una sala eliminada lógicamente da 409 ROOM_ID_TAKEN', async () => {
      await del('/api/company/rooms/r1');
      const sala = (id) => ({ id, codigo: id, nombre: id, tipo: 'sala', x: 0, y: 0, w: 10, h: 10 });
      const r = await call('PUT', '/api/company/floors/f1/map', {
        token: 'a',
        body: { ancho: 1000, alto: 600, origen: 'manual', salas: [sala('r1'), sala('r2')] },
      });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'ROOM_ID_TAKEN');
      assert.equal((await roomModel.findById('r1')).status, 'INACTIVE');
    });

    it('guardar el mapa sin la sala eliminada funciona y no la reactiva', async () => {
      await del('/api/company/rooms/r1');
      const r = await call('PUT', '/api/company/floors/f1/map', {
        token: 'a',
        body: {
          ancho: 1000,
          alto: 600,
          origen: 'manual',
          salas: [
            { id: 'r2', codigo: 'R2', nombre: 'Sala r2', tipo: 'sala', x: 0, y: 0, w: 10, h: 10 },
          ],
        },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.salasDesactivadas, 0);
      assert.ok((await roomModel.findById('r1')).deletedAt);
    });

    it('una sala borrada del todo puede volver a crearse en el mapa', async () => {
      await del('/api/company/rooms/r2');
      const r = await call('PUT', '/api/company/floors/f1/map', {
        token: 'a',
        body: {
          ancho: 1000,
          alto: 600,
          origen: 'manual',
          salas: [
            { id: 'r2', codigo: 'R2', nombre: 'Nueva', tipo: 'sala', x: 0, y: 0, w: 10, h: 10 },
          ],
        },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.salasCreadas, 1);
    });
  });

  describe('historial de reservas', () => {
    it('el detalle de una reserva antigua sigue mostrando sala, planta y edificio eliminados', async () => {
      await del('/api/company/buildings/b1');
      tokens.cliente = { uid: 'u-cli', role: 'CLIENT' };
      const mine = await call('GET', '/api/bookings/bk-old', { token: 'cliente' });
      assert.equal(mine.status, 200);
      assert.equal(mine.body.sala.nombre, 'Sala r1');
      assert.equal(mine.body.planta.nombre, 'Planta 1');
      assert.equal(mine.body.edificio.nombre, 'Edif 1');

      const company = await call('GET', '/api/company/bookings/bk-old', { token: 'a' });
      assert.equal(company.status, 200);
      assert.equal(company.body.sala.nombre, 'Sala r1');
      assert.equal(company.body.edificio.nombre, 'Edif 1');
      assert.equal(company.body.cliente.email, 'ana@x.com');

      const list = await call('GET', `/api/company/bookings?desde=${PASADO}&hasta=${PASADO}`, {
        token: 'a',
      });
      assert.equal(list.status, 200);
      assert.equal(list.body.reservas.length, 1);
      assert.equal(list.body.reservas[0].sala.nombre, 'Sala r1');
      const byRoom = await call(
        'GET',
        `/api/company/bookings?roomId=r1&desde=${PASADO}&hasta=${PASADO}`,
        {
          token: 'a',
        },
      );
      assert.equal(byRoom.status, 200);

      const admin = await call('GET', '/api/admin/bookings/bk-old', { token: 'admin' });
      assert.equal(admin.status, 200);
      assert.equal(admin.body.sala.nombre, 'Sala r1');
      assert.equal(admin.body.edificio.nombre, 'Edif 1');
    });
  });

  describe('límites y datos inconsistentes', () => {
    it('400 TOO_MANY_CHANGES si hay demasiadas salas, sin tocar nada', async () => {
      for (let i = 0; i < 495; i++) await mkRoom(`mass-${i}`, 'b2', 'f3');
      const r = await del('/api/company/buildings/b2');
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'TOO_MANY_CHANGES');
      assert.equal(await exists(buildingModel, 'b2'), true);
      assert.equal(await exists(roomModel, 'mass-0'), true);
    });

    it('409 INCONSISTENT_DATA si cuelga una sala de otra empresa y no se toca nada', async () => {
      await mkRoom('r-intruso', 'b2', 'f3', 'c-b');
      const r = await del('/api/company/buildings/b2');
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'INCONSISTENT_DATA');
      assert.equal(await exists(buildingModel, 'b2'), true);
      assert.equal(await exists(roomModel, 'r4'), true);
      assert.equal(await exists(roomModel, 'r-intruso'), true);
    });

    it('un bloqueo con fechas mal formadas no da 500: se borra igualmente', async () => {
      await blockModel.create(
        { companyId: 'c-a', roomId: 'r4', startDate: 'no-es-fecha', endDate: 'x', reason: 'raro' },
        { id: 'bl-raro' },
      );
      const r = await del('/api/company/rooms/r4');
      assert.equal(r.status, 200);
      assert.equal(r.body.bloqueosEliminados, 1);
      assert.equal(await exists(blockModel, 'bl-raro'), false);
    });

    it('una sala fuera del mapa de su planta también se elimina', async () => {
      await roomModel.update('r5', { name: 'Sala r5' });
      await floorModel.update('f3', { salas: [] });
      assert.equal((await del('/api/company/rooms/r5')).status, 200);
      assert.equal(await exists(roomModel, 'r5'), false);
    });
  });

  describe('GET /company/rooms/:id/future-bookings', () => {
    it('200: solo las futuras activas, por inicio ascendente y sin datos privados', async () => {
      await mkBooking('bk-late', 'r2', FUTURO2);
      await mkBooking('bk-soon', 'r2', FUTURO, 'PENDING_PAYMENT');
      await mkBooking('bk-cancel', 'r2', FUTURO, 'CANCELLED');
      await mkBooking('bk-past', 'r2', PASADO);
      const r = await call('GET', '/api/company/rooms/r2/future-bookings', { token: 'a' });
      assert.equal(r.status, 200);
      assert.deepEqual(
        r.body.reservas.map((b) => b.id),
        ['bk-soon', 'bk-late'],
      );
      const first = r.body.reservas[0];
      assert.equal(first.estado, 'PENDING_PAYMENT');
      assert.equal(first.fecha, FUTURO);
      assert.equal(first.sala.nombre, 'Sala r2');
      assert.deepEqual(first.cliente, { nombre: 'Ana Ruiz', email: 'ana@x.com' });
      assert.equal(r.text.includes('userId'), false);
      assert.equal(r.text.includes('u-cli'), false);
    });

    it('200 con lista vacía si no hay reservas futuras', async () => {
      const r = await call('GET', '/api/company/rooms/r2/future-bookings', { token: 'a' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { reservas: [] });
    });

    it('404 si la sala está eliminada y 404 si no existe', async () => {
      await del('/api/company/rooms/r1');
      assert.equal(
        (await call('GET', '/api/company/rooms/r1/future-bookings', { token: 'a' })).status,
        404,
      );
      assert.equal(
        (await call('GET', '/api/company/rooms/nada/future-bookings', { token: 'a' })).status,
        404,
      );
    });
  });
});
