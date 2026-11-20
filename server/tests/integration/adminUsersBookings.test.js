// Test de integración del panel de admin sobre usuarios, reservas y resumen
// (/api/admin/users, /bookings, /bookings/:id y /summary) con Firestore sustituido por un doble.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import * as userModel from '../../src/models/userModel.js';
import { addDays, todayString } from '../../src/utils/dates.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const tokens = {
  admin: { uid: 'admin-1', role: 'ADMIN' },
  cliente: { uid: 'u1', role: 'CLIENT' },
  empresa: { uid: 'owner-1', role: 'COMPANY', companyId: 'c1' },
};
const RUTAS = [
  '/api/admin/users',
  '/api/admin/bookings',
  '/api/admin/bookings/b1',
  '/api/admin/summary',
];

describe('Panel de admin: usuarios, reservas y resumen', () => {
  let server;
  let baseUrl;

  async function get(path, token = 'admin') {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text };
  }

  async function mkUser(id, data, createdAt) {
    await userModel.create(data, { id });
    await userModel.update(id, { createdAt: new Date(createdAt) });
  }

  // Reserva el día `fecha` (AAAA-MM-DD) de `inicio` a `fin` horas.
  async function mkBooking(id, roomId, companyId, fecha, status, extra = {}) {
    const [y, m, d] = fecha.split('-').map(Number);
    await bookingModel.create(
      {
        code: `IP-${id}`,
        userId: 'u1',
        companyId,
        roomId,
        startDate: new Date(y, m - 1, d, 10),
        endDate: new Date(y, m - 1, d, 12),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 50,
        status,
        ...extra,
      },
      { id },
    );
  }

  const hoy = todayString();

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await companyModel.upsert('c1', {
      name: 'Empresa Uno',
      status: 'APPROVED',
      ownerUid: 'owner-1',
    });
    await companyModel.upsert('c2', {
      name: 'Empresa Dos',
      status: 'PENDING',
      ownerUid: 'owner-2',
    });
    await companyModel.upsert('c3', { name: 'Empresa Tres', status: 'SUSPENDED' });
    await companyModel.upsert('c4', { name: 'Empresa Cuatro', status: 'REJECTED' });
    await buildingModel.upsert('b-1', { companyId: 'c1', name: 'Torre Uno', city: 'Sevilla' });
    await buildingModel.upsert('b-2', { companyId: 'c2', name: 'Torre Dos', city: 'Madrid' });
    await roomModel.upsert('r1', { companyId: 'c1', buildingId: 'b-1', name: 'Sala Uno' });
    await roomModel.upsert('r2', { companyId: 'c2', buildingId: 'b-2', name: 'Sala Dos' });
    await mkUser(
      'u1',
      {
        name: 'Ángela',
        surname: 'Núñez',
        email: 'angela@x.com',
        phone: '600111222',
        role: 'CLIENT',
      },
      '2026-01-01T00:00:00Z',
    );
    await mkUser(
      'u2',
      { name: 'Luis', surname: 'Gómez', email: 'luis@correo.es', role: 'CLIENT' },
      '2026-02-01T00:00:00Z',
    );
    await mkUser(
      'owner-1',
      { name: 'Olga', surname: 'Dueña', email: 'olga@x.com', role: 'COMPANY' },
      '2026-03-01T00:00:00Z',
    );
    await mkUser(
      'owner-2',
      { name: 'Omar', email: 'omar@x.com', role: 'COMPANY', companyId: 'c2' },
      '2026-03-02T00:00:00Z',
    );
    await mkUser(
      'admin-1',
      { name: 'Admin', email: 'admin@x.com', role: 'ADMIN' },
      '2025-12-01T00:00:00Z',
    );
    await mkBooking('b1', 'r1', 'c1', addDays(hoy, 1), 'CONFIRMED');
    await mkBooking('b2', 'r1', 'c1', addDays(hoy, 2), 'CANCELLED', {
      cancelReason: 'Cambio de planes',
      cancelledBy: 'CLIENT',
    });
    await mkBooking('b3', 'r2', 'c2', addDays(hoy, 3), 'CONFIRMED');
    await mkBooking('b-viejo', 'r2', 'c2', addDays(hoy, -200), 'CONFIRMED');
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('permisos', () => {
    for (const ruta of RUTAS) {
      it(`${ruta}: 401 sin token, 403 a cliente y empresa, 200 o 404 a admin`, async () => {
        assert.equal((await get(ruta, null)).status, 401);
        assert.equal((await get(ruta, 'cliente')).status, 403);
        assert.equal((await get(ruta, 'empresa')).status, 403);
        const ok = await get(ruta, 'admin');
        assert.equal(ok.status, 200);
      });
    }
  });

  describe('GET /api/admin/users', () => {
    it('lista usuarios del más reciente al más antiguo con empresa y sin teléfono', async () => {
      const { body, text } = await get('/api/admin/users');
      assert.deepEqual(
        body.usuarios.map((u) => u.id),
        ['owner-2', 'owner-1', 'u2', 'u1', 'admin-1'],
      );
      assert.equal(body.total, 5);
      assert.equal(body.page, 1);
      assert.equal(body.limit, 20);
      assert.equal(body.truncado, false);
      const [omar, olga] = body.usuarios;
      assert.deepEqual(omar.empresa, { id: 'c2', nombre: 'Empresa Dos' });
      assert.deepEqual(olga.empresa, { id: 'c1', nombre: 'Empresa Uno' });
      assert.equal(olga.nombre, 'Olga Dueña');
      assert.equal(olga.rol, 'COMPANY');
      assert.equal(body.usuarios[3].empresa, null);
      assert.ok(body.usuarios[3].fechaAlta.startsWith('2026-01-01'));
      assert.ok(!text.includes('600111222'));
      assert.ok(!text.includes('phone'));
    });

    it('filtra por rol y rechaza un rol inválido', async () => {
      const { body } = await get('/api/admin/users?rol=CLIENT');
      assert.deepEqual(body.usuarios.map((u) => u.id).sort(), ['u1', 'u2']);
      assert.equal(body.total, 2);
      assert.equal((await get('/api/admin/users?rol=cliente')).status, 400);
      assert.equal((await get('/api/admin/users?rol[]=CLIENT')).status, 400);
    });

    it('busca por nombre sin tildes ni mayúsculas y por email', async () => {
      const nombre = await get('/api/admin/users?q=ANGELA%20nunez');
      assert.deepEqual(
        nombre.body.usuarios.map((u) => u.id),
        ['u1'],
      );
      const email = await get('/api/admin/users?q=CORREO.es');
      assert.deepEqual(
        email.body.usuarios.map((u) => u.id),
        ['u2'],
      );
      assert.equal((await get('/api/admin/users?q=zzz')).body.total, 0);
      assert.equal((await get(`/api/admin/users?q=${'a'.repeat(101)}`)).status, 400);
    });

    it('valida page y pagina de 20 en 20', async () => {
      for (let i = 0; i < 22; i++) {
        await mkUser(
          `x${i}`,
          { name: `Extra ${i}`, email: `x${i}@x.com`, role: 'CLIENT' },
          '2026-06-01T00:00:00Z',
        );
      }
      const p1 = await get('/api/admin/users');
      const p2 = await get('/api/admin/users?page=2');
      assert.equal(p1.body.usuarios.length, 20);
      assert.equal(p2.body.usuarios.length, 7);
      assert.equal(p2.body.total, 27);
      assert.equal(p2.body.page, 2);
      const ids = new Set([...p1.body.usuarios, ...p2.body.usuarios].map((u) => u.id));
      assert.equal(ids.size, 27);
      assert.equal((await get('/api/admin/users?page=3')).body.usuarios.length, 0);
      for (const page of ['0', '1001', 'abc', '1.5']) {
        assert.equal((await get(`/api/admin/users?page=${page}`)).status, 400, page);
      }
    });
  });

  describe('GET /api/admin/bookings', () => {
    it('lista reservas de todas las empresas con sala, edificio, empresa y cliente', async () => {
      const { status, body, text } = await get('/api/admin/bookings');
      assert.equal(status, 200);
      assert.deepEqual(
        body.reservas.map((r) => r.id),
        ['b3', 'b2', 'b1'],
      );
      assert.equal(body.total, 3);
      assert.equal(body.page, 1);
      assert.equal(body.limit, 20);
      assert.equal(body.desde, addDays(hoy, -30));
      assert.equal(body.hasta, addDays(addDays(hoy, -30), 90));
      assert.equal(body.truncado, false);
      const b3 = body.reservas[0];
      assert.equal(b3.codigo, 'IP-b3');
      assert.equal(b3.importe, 50);
      assert.equal(b3.estado, 'CONFIRMED');
      assert.equal(b3.inicio, 10);
      assert.equal(b3.fin, 12);
      assert.deepEqual(b3.sala, { id: 'r2', nombre: 'Sala Dos' });
      assert.deepEqual(b3.edificio, { id: 'b-2', nombre: 'Torre Dos', ciudad: 'Madrid' });
      assert.deepEqual(b3.empresa, { id: 'c2', nombre: 'Empresa Dos' });
      assert.deepEqual(b3.cliente, { nombre: 'Ángela', email: 'angela@x.com' });
      assert.equal(body.reservas[1].motivoCancelacion, 'Cambio de planes');
      assert.ok(!text.includes('600111222'));
      assert.ok(!text.includes('userId'));
      assert.ok(!text.includes('"u1"'));
    });

    it('filtra por desde y hasta', async () => {
      const qs = `desde=${addDays(hoy, -250)}&hasta=${addDays(hoy, -100)}`;
      const { body } = await get(`/api/admin/bookings?${qs}`);
      assert.deepEqual(
        body.reservas.map((r) => r.id),
        ['b-viejo'],
      );
      const dia = await get(
        `/api/admin/bookings?desde=${addDays(hoy, 2)}&hasta=${addDays(hoy, 2)}`,
      );
      assert.deepEqual(
        dia.body.reservas.map((r) => r.id),
        ['b2'],
      );
    });

    it('responde 400 con un rango inválido, demasiado grande o fechas mal formadas', async () => {
      const rutas = [
        `desde=${addDays(hoy, 5)}&hasta=${addDays(hoy, 1)}`,
        `desde=${addDays(hoy, -400)}&hasta=${addDays(hoy, 1)}`,
        `hasta=${addDays(hoy, 500)}`,
        'desde=2026-02-30',
        'hasta=ayer',
      ];
      for (const qs of rutas) {
        const res = await get(`/api/admin/bookings?${qs}`);
        assert.equal(res.status, 400, qs);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    it('filtra por estado y por companyId', async () => {
      const cancel = await get('/api/admin/bookings?estado=CANCELLED');
      assert.deepEqual(
        cancel.body.reservas.map((r) => r.id),
        ['b2'],
      );
      const empresa = await get('/api/admin/bookings?companyId=c1');
      assert.deepEqual(
        empresa.body.reservas.map((r) => r.id),
        ['b2', 'b1'],
      );
      const ambos = await get('/api/admin/bookings?companyId=c1&estado=CONFIRMED');
      assert.deepEqual(
        ambos.body.reservas.map((r) => r.id),
        ['b1'],
      );
      assert.equal((await get('/api/admin/bookings?estado=cancelada')).status, 400);
      assert.equal((await get('/api/admin/bookings?companyId=a/b')).status, 400);
      assert.equal((await get('/api/admin/bookings?estado[]=CONFIRMED')).status, 400);
    });

    it('pagina de 20 en 20 y valida page', async () => {
      for (let i = 0; i < 22; i++) {
        await mkBooking(`m${i}`, 'r1', 'c1', addDays(hoy, 10), 'CONFIRMED');
      }
      const p1 = await get('/api/admin/bookings');
      const p2 = await get('/api/admin/bookings?page=2');
      assert.equal(p1.body.reservas.length, 20);
      assert.equal(p2.body.reservas.length, 5);
      assert.equal(p2.body.total, 25);
      assert.equal(p2.body.page, 2);
      assert.equal(p2.body.reservas[0].sala.nombre, 'Sala Uno');
      assert.equal((await get('/api/admin/bookings?page=0')).status, 400);
    });
  });

  describe('GET /api/admin/bookings/:id', () => {
    it('devuelve el detalle con empresa y cliente, sin teléfono ni uid', async () => {
      const { status, body, text } = await get('/api/admin/bookings/b3');
      assert.equal(status, 200);
      assert.equal(body.codigo, 'IP-b3');
      assert.deepEqual(body.empresa, { id: 'c2', nombre: 'Empresa Dos' });
      assert.deepEqual(body.cliente, { nombre: 'Ángela', email: 'angela@x.com' });
      assert.equal(body.sala.nombre, 'Sala Dos');
      assert.equal(body.edificio.nombre, 'Torre Dos');
      assert.ok(!text.includes('600111222'));
      assert.ok(!text.includes('userId'));
    });

    it('responde 404 si no existe y 400 con un id inválido', async () => {
      const nada = await get('/api/admin/bookings/no-existe');
      assert.equal(nada.status, 404);
      assert.equal(nada.body.error.code, 'NOT_FOUND');
      assert.equal((await get('/api/admin/bookings/a.b')).status, 400);
    });
  });

  describe('GET /api/admin/summary', () => {
    it('cuenta empresas por estado, usuarios por rol y reservas del mes', async () => {
      const hoyDate = new Date();
      const mes = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}`;
      await mkBooking('mes1', 'r1', 'c1', `${mes}-15`, 'CONFIRMED');
      await mkBooking('mes2', 'r1', 'c1', `${mes}-16`, 'CANCELLED');
      await mkBooking('mes3', 'r2', 'c2', `${mes}-17`, 'CONFIRMED');
      const { status, body } = await get('/api/admin/summary');
      assert.equal(status, 200);
      assert.deepEqual(body.empresas, { pendiente: 1, aprobada: 1, rechazada: 1, suspendida: 1 });
      assert.deepEqual(body.usuarios, { CLIENT: 2, COMPANY: 2, ADMIN: 1 });
      assert.equal(body.reservasMes.mes, mes);
      assert.equal(body.reservasMes.porEstado.CONFIRMED >= 2, true);
      assert.equal(body.reservasMes.porEstado.CANCELLED >= 1, true);
      const suma = Object.values(body.reservasMes.porEstado).reduce((a, b) => a + b, 0);
      assert.equal(suma, body.reservasMes.total);
      assert.ok(body.reservasMes.total >= 3);
    });
  });
});
