// Tests unitarios de los models de Firestore, con Firestore sustituido por un doble en memoria.
import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { now } from '../../src/models/baseModel.js';
import * as blockModel from '../../src/models/blockModel.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import * as userModel from '../../src/models/userModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';

const isServerTimestamp = (value) => value?.isEqual?.(now()) === true;

let fake;
beforeEach(() => {
  fake = createFakeFirestore();
  setDbForTests(fake);
});
after(() => setDbForTests(null));

describe('userModel', () => {
  it('crea con el UID como id, añade timestamps y busca por email y rol', async () => {
    await userModel.create(
      { name: 'Ana', email: 'ana@example.com', role: 'CLIENT' },
      { id: 'uid-1' },
    );
    const user = await userModel.findById('uid-1');
    assert.equal(user.id, 'uid-1');
    assert.equal(user.name, 'Ana');
    assert.ok(isServerTimestamp(user.createdAt));
    assert.ok(isServerTimestamp(user.updatedAt));

    assert.equal((await userModel.findByEmail('ana@example.com')).id, 'uid-1');
    assert.equal(await userModel.findByEmail('nadie@example.com'), null);
    assert.equal((await userModel.listByRole('CLIENT')).length, 1);
  });

  it('findById devuelve null si no existe y create falla si el id ya existe', async () => {
    assert.equal(await userModel.findById('no-existe'), null);
    await userModel.create({ name: 'Ana' }, { id: 'uid-1' });
    await assert.rejects(() => userModel.create({ name: 'Otra' }, { id: 'uid-1' }));
  });
});

describe('companyModel', () => {
  it('update cambia campos y renueva updatedAt; gestiona members', async () => {
    const id = await companyModel.create({ name: 'Acme', verified: false });
    await companyModel.update(id, { verified: true });

    const company = await companyModel.findById(id);
    assert.equal(company.verified, true);
    assert.ok(isServerTimestamp(company.updatedAt));
    assert.equal((await companyModel.listByVerified(true)).length, 1);

    await companyModel.setMember(id, 'uid-1', 'OWNER');
    const member = await companyModel.findMember(id, 'uid-1');
    assert.equal(member.role, 'OWNER');
    assert.ok(isServerTimestamp(member.joinedAt));
    assert.equal((await companyModel.listMembers(id)).length, 1);

    await companyModel.removeMember(id, 'uid-1');
    assert.equal(await companyModel.findMember(id, 'uid-1'), null);
  });

  it('update falla si la empresa no existe', async () => {
    await assert.rejects(() => companyModel.update('no-existe', { name: 'X' }));
  });
});

describe('buildingModel', () => {
  it('lista los edificios por empresa y por estado', async () => {
    await buildingModel.create({ companyId: 'c1', name: 'A', status: 'PUBLISHED' });
    await buildingModel.create({ companyId: 'c1', name: 'B', status: 'DRAFT' });
    await buildingModel.create({ companyId: 'c2', name: 'C', status: 'PUBLISHED' });

    assert.equal((await buildingModel.listByCompany('c1')).length, 2);
    assert.deepEqual((await buildingModel.listByStatus('PUBLISHED')).map((b) => b.name).sort(), [
      'A',
      'C',
    ]);
  });
});

describe('floorModel', () => {
  it('guarda companyId y el mapa en salas, y lista las plantas de un edificio por nivel', async () => {
    const salas = [
      { id: 's1', codigo: 'S1', nombre: 'Sala', tipo: 'sala', x: 0, y: 0, w: 10, h: 10 },
    ];
    await floorModel.create({ companyId: 'c1', buildingId: 'b1', level: 2, salas }, { id: 'f2' });
    await floorModel.create(
      { companyId: 'c1', buildingId: 'b1', level: 0, salas: [] },
      { id: 'f0' },
    );
    await floorModel.create(
      { companyId: 'c1', buildingId: 'b2', level: 1, salas: [] },
      { id: 'f9' },
    );

    const floors = await floorModel.listByBuilding('b1');
    assert.deepEqual(
      floors.map((f) => f.id),
      ['f0', 'f2'],
    );
    assert.deepEqual(floors[1].salas, salas);
    assert.equal(floors[1].companyId, 'c1');
    assert.equal((await floorModel.listByCompany('c1')).length, 3);
  });
});

describe('roomModel', () => {
  it('upsert con id fijo no duplica y conserva createdAt', async () => {
    await roomModel.upsert('p0-s01', { companyId: 'c1', floorId: 'f0', price: 40 });
    const first = await roomModel.findById('p0-s01');
    await roomModel.upsert('p0-s01', { companyId: 'c1', floorId: 'f0', price: 44 });

    const rooms = await roomModel.listByFloor('f0');
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].price, 44);
    assert.equal(rooms[0].createdAt, first.createdAt);
    assert.equal((await roomModel.listByCompany('c1')).length, 1);
  });

  it('remove borra la sala', async () => {
    await roomModel.create({ buildingId: 'b1' }, { id: 'r1' });
    await roomModel.remove('r1');
    assert.equal(await roomModel.findById('r1'), null);
    assert.equal((await roomModel.listByBuilding('b1')).length, 0);
  });
});

describe('bookingModel', () => {
  it('lista las reservas de una sala en un rango de fechas, ordenadas', async () => {
    const at = (day, hour) => new Date(2026, 10, day, hour);
    await bookingModel.create({
      roomId: 'r1',
      userId: 'u1',
      companyId: 'c1',
      startDate: at(19, 12),
    });
    await bookingModel.create({
      roomId: 'r1',
      userId: 'u1',
      companyId: 'c1',
      startDate: at(19, 9),
    });
    await bookingModel.create({
      roomId: 'r1',
      userId: 'u2',
      companyId: 'c1',
      startDate: at(20, 9),
    });
    await bookingModel.create({
      roomId: 'r2',
      userId: 'u1',
      companyId: 'c1',
      startDate: at(19, 9),
    });

    const sameDay = await bookingModel.listByRoom('r1', { from: at(19, 0), to: at(20, 0) });
    assert.deepEqual(
      sameDay.map((b) => b.startDate.getHours()),
      [9, 12],
    );
    assert.equal((await bookingModel.listByRoom('r1')).length, 3);
    assert.equal((await bookingModel.listByUser('u1')).length, 3);
    assert.equal((await bookingModel.listByCompany('c1')).length, 4);
  });

  it('funciona dentro de una transacción', async () => {
    const id = await fake.runTransaction(async (tx) => {
      return bookingModel.create({ roomId: 'r1', status: 'PENDING_PAYMENT' }, { id: 'b1', tx });
    });
    await fake.runTransaction((tx) => bookingModel.update(id, { status: 'CONFIRMED' }, { tx }));
    assert.equal((await bookingModel.findById('b1')).status, 'CONFIRMED');
  });
});

describe('blockModel', () => {
  it('guarda companyId y lista los bloqueos por sala y por empresa', async () => {
    const start = new Date(2026, 10, 19, 8);
    await blockModel.create({
      companyId: 'c1',
      roomId: 'r1',
      startDate: start,
      reason: 'Limpieza',
    });
    await blockModel.create({ companyId: 'c1', roomId: 'r2', startDate: start, reason: 'Obra' });

    const blocks = await blockModel.listByRoom('r1');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].companyId, 'c1');
    assert.equal(blocks[0].reason, 'Limpieza');
    assert.equal((await blockModel.listByCompany('c1')).length, 2);
  });
});

describe('occupancyModel', () => {
  it('slotId tiene un formato fijo y create no permite ocupar dos veces la misma hora', async () => {
    const id = occupancyModel.slotId('r1', '2026-11-19', 9);
    assert.equal(id, 'r1_2026-11-19_09');

    await occupancyModel.create(
      { roomId: 'r1', date: '2026-11-19', hour: 9, bookingId: 'b1' },
      { id },
    );
    await assert.rejects(() =>
      occupancyModel.create({ roomId: 'r1', date: '2026-11-19', hour: 9, bookingId: 'b2' }, { id }),
    );
  });

  it('lista las horas de una sala en un día y las libera por reserva', async () => {
    for (const hour of [11, 10]) {
      const id = occupancyModel.slotId('r1', '2026-11-19', hour);
      await occupancyModel.create(
        { roomId: 'r1', date: '2026-11-19', hour, bookingId: 'b1' },
        { id },
      );
    }
    await occupancyModel.create(
      { roomId: 'r1', date: '2026-11-20', hour: 10, blockId: 'k1' },
      { id: occupancyModel.slotId('r1', '2026-11-20', 10) },
    );

    const slots = await occupancyModel.listByRoomAndDate('r1', '2026-11-19');
    assert.deepEqual(
      slots.map((s) => s.hour),
      [10, 11],
    );
    assert.equal((await occupancyModel.listByBlock('k1')).length, 1);
    assert.equal(await occupancyModel.removeByBooking('b1'), 2);
    assert.equal((await occupancyModel.listByRoomAndDate('r1', '2026-11-19')).length, 0);
  });
});
