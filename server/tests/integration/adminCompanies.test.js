// Test de integración del panel de admin sobre empresas (/api/admin/companies/*) y de sus efectos:
// la empresa suspendida pierde el panel y sus edificios desaparecen de la API pública.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as userModel from '../../src/models/userModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen, seedPublicData } from '../helpers/publicData.js';

const tokens = {
  admin: { uid: 'admin-1', role: 'ADMIN' },
  cliente: { uid: 'u1', role: 'CLIENT' },
  empresa: { uid: 'owner-1', role: 'COMPANY', companyId: 'c1' },
};
const FUTURA = '2030-03-12';

describe('Panel de admin: empresas', () => {
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
    return { status: res.status, body: await res.json() };
  }
  const admin = (method, path, body) => call(method, path, { token: 'admin', body });
  const suspender = (id = 'c1', motivo = 'Impago de la cuota') =>
    admin('POST', `/api/admin/companies/${id}/suspend`, { motivo });

  // Empresas con fecha de alta fija para comprobar el orden.
  async function mkCompany(id, status, createdAt, extra = {}) {
    await companyModel.create(
      {
        name: `Empresa ${id}`,
        taxId: `CIF-${id}`,
        email: `${id}@x.com`,
        status,
        verified: status === 'APPROVED',
        ownerUid: 'owner-1',
        ...extra,
      },
      { id },
    );
    await companyModel.update(id, { createdAt: new Date(createdAt) });
  }

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => tokens[token]);
    await seedPublicData();
    await userModel.create(
      { name: 'Ana', surname: 'Pérez', email: 'ana@x.com', role: 'COMPANY' },
      { id: 'owner-1' },
    );
    await mkCompany('c1', 'APPROVED', '2026-01-01T00:00:00Z');
    await mkCompany('c-pend', 'PENDING', '2026-03-01T00:00:00Z');
    await mkCompany('c-rej', 'REJECTED', '2026-02-01T00:00:00Z', { rejectionReason: 'CIF falso' });
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('permisos', () => {
    const rutas = [
      ['GET', '/api/admin/companies'],
      ['GET', '/api/admin/companies/c1'],
      ['POST', '/api/admin/companies/c-pend/approve'],
      ['POST', '/api/admin/companies/c-pend/reject'],
      ['POST', '/api/admin/companies/c1/suspend'],
      ['POST', '/api/admin/companies/c1/reactivate'],
    ];
    for (const [method, path] of rutas) {
      it(`${method} ${path}: 401 sin token, 403 a CLIENT y a COMPANY`, async () => {
        assert.equal(
          (await call(method, path, { body: method === 'GET' ? undefined : {} })).status,
          401,
        );
        assert.equal(
          (await call(method, path, { token: 'cliente', body: method === 'GET' ? undefined : {} }))
            .status,
          403,
        );
        assert.equal(
          (await call(method, path, { token: 'empresa', body: method === 'GET' ? undefined : {} }))
            .status,
          403,
        );
      });
    }
  });

  describe('GET /api/admin/companies', () => {
    it('lista todas ordenadas por fecha de solicitud descendente', async () => {
      const { status, body } = await admin('GET', '/api/admin/companies');
      assert.equal(status, 200);
      assert.deepEqual(
        body.empresas.map((e) => e.id),
        ['c-pend', 'c-rej', 'c1'],
      );
      assert.deepEqual(body.empresas[0], {
        id: 'c-pend',
        nombre: 'Empresa c-pend',
        cif: 'CIF-c-pend',
        email: 'c-pend@x.com',
        estado: 'pendiente',
        fechaSolicitud: '2026-03-01T00:00:00.000Z',
        verificada: false,
      });
      assert.equal(body.empresas[2].verificada, true);
    });

    it('filtra por estado y trata las empresas sin status como pendientes', async () => {
      await companyModel.create({ name: 'Vieja', taxId: 'V1', verified: false }, { id: 'c-old' });
      const pend = await admin('GET', '/api/admin/companies?estado=pendiente');
      assert.deepEqual(pend.body.empresas.map((e) => e.id).sort(), ['c-old', 'c-pend']);
      const rej = await admin('GET', '/api/admin/companies?estado=rechazada');
      assert.deepEqual(
        rej.body.empresas.map((e) => e.id),
        ['c-rej'],
      );
    });

    it('400 con estado inválido, repetido o con corchetes', async () => {
      for (const q of ['estado=PENDING', 'estado=a&estado=b', 'estado[]=pendiente']) {
        const { status, body } = await admin('GET', `/api/admin/companies?${q}`);
        assert.equal(status, 400, q);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('GET /api/admin/companies/:id', () => {
    it('devuelve el detalle con dueño y edificios, sin datos internos', async () => {
      const { status, body } = await admin('GET', '/api/admin/companies/c1');
      assert.equal(status, 200);
      assert.equal(body.nombre, 'Empresa c1');
      assert.equal(body.estado, 'aprobada');
      assert.equal(body.motivo, null);
      assert.deepEqual(body.dueno, { nombre: 'Ana Pérez', email: 'ana@x.com' });
      const ids = body.edificios.map((b) => b.id).sort();
      assert.deepEqual(ids, ['b-draft', 'b-pub']);
      assert.equal(body.edificios.find((b) => b.id === 'b-pub').publicado, true);
      assert.equal(body.edificios.find((b) => b.id === 'b-draft').publicado, false);
      assert.equal('ownerUid' in body, false);
      assert.equal('reviewedBy' in body, false);
    });

    it('un rechazo muestra su motivo', async () => {
      const { body } = await admin('GET', '/api/admin/companies/c-rej');
      assert.equal(body.estado, 'rechazada');
      assert.equal(body.motivo, 'CIF falso');
    });

    it('404 si no existe', async () => {
      const { status, body } = await admin('GET', '/api/admin/companies/nada');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
    });
  });

  describe('aprobar y rechazar', () => {
    it('approve: PENDING pasa a APPROVED, verified true y queda quién lo revisó', async () => {
      const { status, body } = await admin('POST', '/api/admin/companies/c-pend/approve');
      assert.equal(status, 200);
      assert.equal(body.estado, 'aprobada');
      assert.equal(body.verificada, true);
      assert.ok(body.revisadaEn);
      const saved = await companyModel.findById('c-pend');
      assert.equal(saved.status, 'APPROVED');
      assert.equal(saved.verified, true);
      assert.equal(saved.reviewedBy, 'admin-1');
      assert.ok(saved.reviewedAt);
    });

    it('reject sin motivo, corto, largo o no texto: 400', async () => {
      const url = '/api/admin/companies/c-pend/reject';
      for (const motivo of [undefined, '', 'ab', '  a  ', 'x'.repeat(501), 42, ['abc']]) {
        const { status } = await admin('POST', url, motivo === undefined ? {} : { motivo });
        assert.equal(status, 400, String(motivo));
      }
      assert.equal((await companyModel.findById('c-pend')).status, 'PENDING');
    });

    it('reject con motivo: REJECTED y motivo guardado (recortado)', async () => {
      const { status, body } = await admin('POST', '/api/admin/companies/c-pend/reject', {
        motivo: '  Documentación incompleta  ',
      });
      assert.equal(status, 200);
      assert.equal(body.estado, 'rechazada');
      assert.equal(body.motivo, 'Documentación incompleta');
      const saved = await companyModel.findById('c-pend');
      assert.equal(saved.status, 'REJECTED');
      assert.equal(saved.verified, false);
      assert.equal(saved.rejectionReason, 'Documentación incompleta');
      assert.equal(saved.reviewedBy, 'admin-1');
    });

    it('404 en una empresa inexistente', async () => {
      assert.equal((await admin('POST', '/api/admin/companies/nada/approve')).status, 404);
    });
  });

  describe('suspender y reactivar', () => {
    it('suspend: SUSPENDED con motivo, edificios marcados y aviso de reservas futuras', async () => {
      const reserva = await call('POST', '/api/bookings', {
        token: 'cliente',
        body: { roomId: 'r-free', fecha: FUTURA, inicio: 10, fin: 12 },
      });
      assert.equal(reserva.status, 201);

      const { status, body } = await suspender();
      assert.equal(status, 200);
      assert.equal(body.estado, 'suspendida');
      assert.equal(body.motivo, 'Impago de la cuota');
      assert.equal(body.verificada, false);
      assert.equal(body.reservasFuturas, 1);
      assert.match(body.aviso, /1 reserva futura/);
      const saved = await companyModel.findById('c1');
      assert.equal(saved.status, 'SUSPENDED');
      assert.equal(saved.verified, false);
      assert.equal(saved.suspensionReason, 'Impago de la cuota');
      assert.equal(saved.reviewedBy, 'admin-1');
      const buildings = await buildingModel.listByCompany('c1');
      assert.ok(buildings.length >= 2);
      assert.ok(buildings.every((b) => b.companySuspended === true));
      // Los edificios conservan su status.
      assert.equal((await buildingModel.findById('b-pub')).status, 'PUBLISHED');
    });

    it('suspend sin reservas futuras no lleva aviso y exige motivo', async () => {
      assert.equal((await admin('POST', '/api/admin/companies/c1/suspend', {})).status, 400);
      const { body } = await suspender();
      assert.equal(body.reservasFuturas, 0);
      assert.equal('aviso' in body, false);
    });

    it('reactivate: vuelve a APPROVED, desmarca edificios y conserva el motivo anterior', async () => {
      await suspender();
      const { status, body } = await admin('POST', '/api/admin/companies/c1/reactivate');
      assert.equal(status, 200);
      assert.equal(body.estado, 'aprobada');
      assert.equal(body.motivo, null);
      const saved = await companyModel.findById('c1');
      assert.equal(saved.status, 'APPROVED');
      assert.equal(saved.verified, true);
      assert.equal(saved.suspensionReason, null);
      assert.equal(saved.lastSuspensionReason, 'Impago de la cuota');
      const buildings = await buildingModel.listByCompany('c1');
      assert.ok(buildings.every((b) => b.companySuspended === false));
    });
  });

  describe('transiciones inválidas', () => {
    const casos = [
      ['approve a una aprobada', 'c1', 'approve', undefined],
      ['reactivate a una pendiente', 'c-pend', 'reactivate', undefined],
      ['suspend a una rechazada', 'c-rej', 'suspend', { motivo: 'Motivo válido' }],
      ['approve a una rechazada', 'c-rej', 'approve', undefined],
      ['reject a una aprobada', 'c1', 'reject', { motivo: 'Motivo válido' }],
      ['suspend a una pendiente', 'c-pend', 'suspend', { motivo: 'Motivo válido' }],
    ];
    for (const [nombre, id, accion, body] of casos) {
      it(`${nombre}: 400 INVALID_TRANSITION`, async () => {
        const antes = (await companyModel.findById(id)).status;
        const res = await admin('POST', `/api/admin/companies/${id}/${accion}`, body);
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'INVALID_TRANSITION');
        assert.equal((await companyModel.findById(id)).status, antes);
      });
    }
  });

  describe('empresa suspendida', () => {
    it('pierde el panel (403 COMPANY_NOT_APPROVED) y /companies/me muestra estado y motivo', async () => {
      await suspender();
      const panel = await call('GET', '/api/company/buildings', { token: 'empresa' });
      assert.equal(panel.status, 403);
      assert.equal(panel.body.error.code, 'COMPANY_NOT_APPROVED');
      assert.match(panel.body.error.message, /suspendida/);
      const me = await call('GET', '/api/companies/me', { token: 'empresa' });
      assert.equal(me.status, 200);
      assert.equal(me.body.estado, 'suspendida');
      assert.equal(me.body.motivo, 'Impago de la cuota');
    });

    it('una empresa rechazada ve su motivo en /companies/me', async () => {
      tokens.empresa.companyId = 'c-rej';
      try {
        const me = await call('GET', '/api/companies/me', { token: 'empresa' });
        assert.equal(me.body.estado, 'rechazada');
        assert.equal(me.body.motivo, 'CIF falso');
      } finally {
        tokens.empresa.companyId = 'c1';
      }
    });

    it('su edificio desaparece de la API pública y vuelve al reactivarla', async () => {
      const publica = async (inicio) => ({
        buscador: await call('GET', '/api/buildings'),
        edificio: await call('GET', '/api/buildings/b-pub'),
        planta: await call('GET', '/api/floors/f-0'),
        sala: await call('GET', '/api/rooms/r-free'),
        horas: await call('GET', '/api/rooms/r-free/availability'),
        reserva: await call('POST', '/api/bookings', {
          token: 'cliente',
          body: { roomId: 'r-free', fecha: FUTURA, inicio, fin: inicio + 1 },
        }),
      });

      const antes = await publica(8);
      assert.ok(antes.buscador.body.edificios.some((b) => b.id === 'b-pub'));
      assert.equal(antes.edificio.status, 200);

      await suspender();
      const durante = await publica(9);
      assert.equal(
        durante.buscador.body.edificios.some((b) => b.id === 'b-pub'),
        false,
      );
      for (const clave of ['edificio', 'planta', 'sala', 'horas', 'reserva']) {
        assert.equal(durante[clave].status, 404, clave);
      }

      await admin('POST', '/api/admin/companies/c1/reactivate');
      const despues = await publica(10);
      assert.ok(despues.buscador.body.edificios.some((b) => b.id === 'b-pub'));
      for (const clave of ['edificio', 'planta', 'sala', 'horas']) {
        assert.equal(despues[clave].status, 200, clave);
      }
      assert.equal(despues.reserva.status, 201);
    });
  });
});
