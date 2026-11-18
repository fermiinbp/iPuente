// Tests unitarios del seed: carga los datos de demo en un doble de Firestore y comprueba que es idempotente.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { DEMO_CLIENT_ID, seed } from '../../scripts/seed.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';

const COLLECTIONS = ['companies', 'buildings', 'floors', 'rooms', 'users', 'bookings', 'occupancy'];

describe('seed', () => {
  let fake;
  const count = () => Object.fromEntries(COLLECTIONS.map((name) => [name, fake.dump(name).length]));

  before(() => {
    fake = createFakeFirestore();
    setDbForTests(fake);
  });
  after(() => setDbForTests(null));

  it('carga empresa, edificio, plantas con su mapa, salas y reservas confirmadas', async () => {
    // Miércoles 18/11/2026.
    const summary = await seed({ today: new Date(2026, 10, 18, 7) });
    assert.equal(summary.bookingsDate, '2026-11-18');

    const counts = count();
    assert.equal(counts.companies, 1);
    assert.equal(counts.buildings, 1);
    assert.equal(counts.floors, 4);
    assert.equal(counts.rooms, summary.rooms);
    assert.ok(counts.bookings >= 1);
    assert.ok(counts.occupancy >= counts.bookings);

    // Cada sala del mapa tiene su documento en rooms con el mismo id y el companyId de la empresa.
    const rooms = new Map(fake.dump('rooms').map((room) => [room.id, room]));
    for (const floor of fake.dump('floors')) {
      assert.equal(floor.companyId, 'demo-company');
      for (const sala of floor.salas) {
        assert.ok(rooms.has(sala.id), `falta rooms/${sala.id}`);
        assert.equal(rooms.get(sala.id).floorId, floor.id);
        assert.equal(rooms.get(sala.id).companyId, 'demo-company');
      }
    }

    for (const booking of fake.dump('bookings')) {
      assert.equal(booking.status, 'CONFIRMED');
      assert.equal(booking.userId, DEMO_CLIENT_ID);
      assert.equal(booking.companyId, 'demo-company');
      assert.equal(rooms.get(booking.roomId).bookable, true);
    }
  });

  it('ejecutarlo dos veces no duplica nada, aunque cambie el día', async () => {
    const before = count();
    await seed({ today: new Date(2026, 10, 18, 7) });
    assert.deepEqual(count(), before);

    // Sábado 21/11 → las reservas pasan al lunes 23 y las horas antiguas se liberan.
    const summary = await seed({ today: new Date(2026, 10, 21, 7) });
    assert.equal(summary.bookingsDate, '2026-11-23');
    assert.deepEqual(count(), before);
    assert.ok(fake.dump('occupancy').every((slot) => slot.date === '2026-11-23'));
  });
});
