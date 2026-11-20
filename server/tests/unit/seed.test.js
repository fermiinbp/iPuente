// Tests unitarios del seed: carga los datos de demo en dobles de Firestore y de Auth y comprueba usuarios, claims, reservas, bloqueo e idempotencia.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setAuthClientForTests } from '../../src/services/authService.js';
import { isValidCif } from '../../src/utils/cif.js';
import { DEMO_BLOCK_ID, DEMO_CLIENT_ID, seed } from '../../scripts/seed.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';

const COLLECTIONS = [
  'companies',
  'companyTaxIds',
  'buildings',
  'floors',
  'rooms',
  'users',
  'bookings',
  'blocks',
  'occupancy',
];
// Contraseñas generadas: no son secretos y así los escáneres no las confunden con claves reales.
const PASSWORD = 'x'.repeat(16);
const SHORT_PASSWORD = 'x'.repeat(5);
const ELEVEN_CHARS = 'x'.repeat(11);
const OTHER_PASSWORD = 'y'.repeat(16);

// Doble mínimo de Firebase Auth: guarda los usuarios en memoria y cuenta las creaciones.
function createFakeAuth(initial = []) {
  const users = new Map(initial.map((u) => [u.uid, { customClaims: {}, ...u }]));
  const calls = { createUser: 0, setCustomUserClaims: 0 };
  return {
    users,
    calls,
    async getUserByEmail(email) {
      const found = [...users.values()].find((u) => u.email === email);
      if (!found) throw Object.assign(new Error('no existe'), { code: 'auth/user-not-found' });
      return found;
    },
    async createUser(data) {
      calls.createUser += 1;
      const user = { customClaims: {}, ...data };
      users.set(user.uid, user);
      return user;
    },
    async setCustomUserClaims(uid, claims) {
      calls.setCustomUserClaims += 1;
      users.get(uid).customClaims = claims;
    },
  };
}

const demoUsers = JSON.parse(
  readFileSync(new URL('../../scripts/data/users.json', import.meta.url), 'utf8'),
);

describe('seed', () => {
  let fake;
  let auth;
  const count = () => Object.fromEntries(COLLECTIONS.map((name) => [name, fake.dump(name).length]));
  // Miércoles 18/11/2026.
  const wednesday = () => new Date(2026, 10, 18, 7);

  before(() => {
    fake = createFakeFirestore();
    auth = createFakeAuth();
    setDbForTests(fake);
    setAuthClientForTests(auth);
  });
  after(() => {
    setDbForTests(null);
    setAuthClientForTests(null);
  });

  it('aborta sin escribir nada si falta la contraseña o es corta', async () => {
    await assert.rejects(
      () => seed({ today: wednesday(), password: undefined }),
      /SEED_DEMO_PASSWORD/,
    );
    await assert.rejects(
      () => seed({ today: wednesday(), password: SHORT_PASSWORD }),
      /SEED_DEMO_PASSWORD/,
    );
    assert.equal(auth.calls.createUser, 0);
    assert.ok(Object.values(count()).every((n) => n === 0));
  });

  it('carga usuarios, empresas, edificio, plantas con su mapa, salas y reservas', async () => {
    const summary = await seed({
      today: wednesday(),
      password: PASSWORD,
      confirm: true,
      withAdmin: true,
    });
    assert.equal(summary.bookingsDate, '2026-11-18');
    assert.equal(summary.usersCreated, demoUsers.length);

    const counts = count();
    assert.equal(counts.companies, 2);
    assert.equal(counts.companyTaxIds, 2);
    assert.equal(counts.buildings, 1);
    assert.equal(counts.floors, 4);
    assert.equal(counts.rooms, summary.rooms);
    assert.equal(counts.users, demoUsers.length);
    assert.ok(counts.bookings >= 1);

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
  });

  it('crea los usuarios en Auth con su contraseña, claims y ficha en users', () => {
    for (const demo of demoUsers) {
      assert.match(demo.email, /@ipuente\.test$/);
      const authUser = auth.users.get(demo.uid);
      assert.equal(authUser.email, demo.email);
      assert.equal(authUser.password, PASSWORD);
      assert.equal(authUser.customClaims.role, demo.rol);

      const profile = fake.dump('users').find((u) => u.id === demo.uid);
      assert.equal(profile.email, demo.email);
      assert.equal(profile.role, demo.rol);
      assert.equal(profile.name, demo.nombre);
      assert.equal(profile.surname, demo.apellidos);
    }
    assert.deepEqual(auth.users.get('demo-company-owner').customClaims, {
      role: 'COMPANY',
      companyId: 'demo-company',
      companyApproved: true,
      demo: true,
    });
    assert.deepEqual(auth.users.get('demo-pending-owner').customClaims, {
      role: 'COMPANY',
      companyId: 'demo-pending-company',
      companyApproved: false,
      demo: true,
    });
    assert.deepEqual(auth.users.get('demo-admin').customClaims, { role: 'ADMIN', demo: true });
    assert.deepEqual(auth.users.get(DEMO_CLIENT_ID).customClaims, { role: 'CLIENT', demo: true });
  });

  it('crea la empresa aprobada y la pendiente con su dueño, miembro y CIF válido', () => {
    const companies = new Map(fake.dump('companies').map((c) => [c.id, c]));
    const approved = companies.get('demo-company');
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.verified, true);
    assert.equal(approved.ownerUid, 'demo-company-owner');
    const pending = companies.get('demo-pending-company');
    assert.equal(pending.status, 'PENDING');
    assert.equal(pending.verified, false);
    assert.equal(pending.ownerUid, 'demo-pending-owner');

    for (const entry of fake.dump('companyTaxIds')) {
      assert.ok(isValidCif(entry.id), `CIF no válido: ${entry.id}`);
      assert.equal(companies.get(entry.companyId).taxId, entry.id);
    }
    // Sin edificios para la pendiente.
    assert.ok(fake.dump('buildings').every((b) => b.companyId === 'demo-company'));
  });

  it('las reservas son del cliente demo y llevan código fijo IP-9xx sin tocar el contador', () => {
    const bookings = fake.dump('bookings');
    assert.ok(bookings.every((b) => b.userId === DEMO_CLIENT_ID && b.companyId === 'demo-company'));
    const codes = bookings.map((b) => b.code);
    assert.equal(new Set(codes).size, codes.length);
    for (const code of codes) {
      assert.match(code, /^IP-9\d\d$/);
      assert.ok(Number(code.replace('IP-', '')) < 1000, `${code} debe ser < IP-1000`);
    }
    assert.deepEqual(fake.dump('counters'), []);
  });

  it('incluye reservas canceladas sin occupancy', () => {
    const cancelled = fake.dump('bookings').filter((b) => b.status === 'CANCELLED');
    assert.ok(cancelled.length >= 1);
    for (const booking of cancelled) {
      assert.ok(booking.cancelledAt);
      assert.ok(['CLIENT', 'COMPANY'].includes(booking.cancelledBy));
      if (booking.cancelledBy === 'COMPANY') assert.ok(booking.cancelReason);
      assert.ok(fake.dump('occupancy').every((slot) => slot.bookingId !== booking.id));
    }
    const confirmed = fake.dump('bookings').filter((b) => b.status === 'CONFIRMED');
    assert.ok(confirmed.length >= 1);
    for (const booking of confirmed) {
      assert.ok(fake.dump('occupancy').some((slot) => slot.bookingId === booking.id));
    }
  });

  it('crea un bloqueo futuro con su occupancy por hora (blockId)', () => {
    const [block] = fake.dump('blocks');
    assert.equal(block.id, DEMO_BLOCK_ID);
    assert.equal(block.companyId, 'demo-company');
    assert.ok(block.startDate > wednesday());
    const slots = fake.dump('occupancy').filter((slot) => slot.blockId === DEMO_BLOCK_ID);
    assert.deepEqual(slots.map((s) => s.hour).sort(), [14, 15]);
    for (const slot of slots) {
      assert.equal(slot.id, `${block.roomId}_${slot.date}_${slot.hour}`);
      assert.equal(slot.roomId, block.roomId);
      assert.equal(slot.bookingId, null);
    }
  });

  it('ejecutarlo dos veces no duplica ni recrea usuarios, aunque cambie el día', async () => {
    const before = count();
    const createdBefore = auth.calls.createUser;
    const second = await seed({
      today: wednesday(),
      password: OTHER_PASSWORD,
      confirm: true,
      withAdmin: true,
    });
    assert.deepEqual(count(), before);
    assert.equal(second.usersCreated, 0);
    assert.equal(auth.calls.createUser, createdBefore);
    // No cambia la contraseña de quien ya existe.
    assert.equal(auth.users.get('demo-admin').password, PASSWORD);

    // Sábado 21/11 → las reservas pasan al lunes 23 y las horas antiguas se liberan.
    const summary = await seed({
      today: new Date(2026, 10, 21, 7),
      password: PASSWORD,
      confirm: true,
      withAdmin: true,
    });
    assert.equal(summary.bookingsDate, '2026-11-23');
    assert.deepEqual(count(), before);
    const bookingDates = new Set(
      fake
        .dump('occupancy')
        .filter((slot) => slot.bookingId)
        .map((slot) => slot.date),
    );
    assert.deepEqual([...bookingDates], ['2026-11-23']);
    assert.equal(summary.blockDate, '2026-11-24');
    assert.ok(
      fake
        .dump('occupancy')
        .filter((slot) => slot.blockId)
        .every((slot) => slot.date === '2026-11-24'),
    );
  });

  it('respeta al usuario que ya existía con otro uid y conserva sus claims', async () => {
    const existing = createFakeAuth([
      {
        uid: 'uid-real-del-cliente',
        email: 'cliente.demo@ipuente.test',
        customClaims: { extra: true, demo: true },
      },
    ]);
    setAuthClientForTests(existing);
    const db = createFakeFirestore();
    setDbForTests(db);
    await seed({ today: wednesday(), password: PASSWORD, confirm: true });

    assert.equal(existing.calls.createUser, demoUsers.length - 2);
    assert.deepEqual(existing.users.get('uid-real-del-cliente').customClaims, {
      extra: true,
      role: 'CLIENT',
      demo: true,
    });
    assert.ok(db.dump('users').some((u) => u.id === 'uid-real-del-cliente'));
    assert.ok(db.dump('bookings').every((b) => b.userId === 'uid-real-del-cliente'));
  });

  describe('protecciones', () => {
    let db;
    let fakeAuth;
    const countAll = () =>
      Object.values(Object.fromEntries(COLLECTIONS.map((c) => [c, db.dump(c).length])));

    // Cada test parte de una base y un Auth vacíos (o con los usuarios que se indiquen).
    const setup = (initial = []) => {
      db = createFakeFirestore();
      fakeAuth = createFakeAuth(initial);
      setDbForTests(db);
      setAuthClientForTests(fakeAuth);
    };

    it('se niega con NODE_ENV=production', async () => {
      setup();
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await assert.rejects(
          () => seed({ today: wednesday(), password: PASSWORD, confirm: true }),
          /production/,
        );
      } finally {
        process.env.NODE_ENV = previous;
      }
      assert.equal(fakeAuth.calls.createUser, 0);
      assert.ok(countAll().every((n) => n === 0));
    });

    it('sin confirmación (--yes) no escribe nada y devuelve el destino', async () => {
      setup();
      const summary = await seed({ today: wednesday(), password: PASSWORD });
      assert.equal(summary.dryRun, true);
      assert.ok(summary.projectId);
      assert.equal(fakeAuth.calls.createUser, 0);
      assert.equal(fakeAuth.calls.setCustomUserClaims, 0);
      assert.ok(countAll().every((n) => n === 0));
    });

    it('rechaza una contraseña de menos de 12 caracteres', async () => {
      setup();
      await assert.rejects(
        () => seed({ today: wednesday(), password: ELEVEN_CHARS, confirm: true }),
        /SEED_DEMO_PASSWORD/,
      );
      assert.equal(fakeAuth.calls.createUser, 0);
    });

    it('sin --admin no crea ni toca al admin demo', async () => {
      setup();
      const summary = await seed({ today: wednesday(), password: PASSWORD, confirm: true });
      assert.equal(summary.usersCreated, demoUsers.length - 1);
      assert.ok(![...fakeAuth.users.values()].some((u) => u.email === 'admin.demo@ipuente.test'));
      assert.ok(!db.dump('users').some((u) => u.role === 'ADMIN'));
    });

    it('un usuario existente que no es demo no se toca y aborta antes de escribir', async () => {
      setup([{ uid: 'otro', email: 'cliente.demo@ipuente.test', customClaims: { role: 'ADMIN' } }]);
      await assert.rejects(
        () => seed({ today: wednesday(), password: PASSWORD, confirm: true }),
        /no es una cuenta demo/,
      );
      assert.deepEqual(fakeAuth.users.get('otro').customClaims, { role: 'ADMIN' });
      assert.equal(fakeAuth.calls.createUser, 0);
      assert.equal(fakeAuth.calls.setCustomUserClaims, 0);
      assert.ok(countAll().every((n) => n === 0));
    });

    it('un admin existente que no es demo se salta con aviso sin tocarlo', async () => {
      setup([
        { uid: 'mi-admin', email: 'admin.demo@ipuente.test', customClaims: { role: 'ADMIN' } },
      ]);
      const summary = await seed({
        today: wednesday(),
        password: PASSWORD,
        confirm: true,
        withAdmin: true,
      });
      assert.deepEqual(summary.skipped, ['admin.demo@ipuente.test']);
      assert.deepEqual(fakeAuth.users.get('mi-admin').customClaims, { role: 'ADMIN' });
      assert.ok(!db.dump('users').some((u) => u.id === 'mi-admin'));
    });
  });
});
