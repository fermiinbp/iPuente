// Test de integración: auth y requireRole con verifyIdToken sustituido por un doble (401 sin token o inválido, 403 por rol, GET /api/users/me).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

import app from '../../src/app.js';
import { setDbForTests } from '../../src/config/config.js';
import { ROLES } from '../../src/config/roles.js';
import { auth, setTokenVerifier } from '../../src/middlewares/auth.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { requireRole } from '../../src/middlewares/requireRole.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';

// Doble de verifyIdToken: no habla con Firebase.
async function fakeVerifier(token) {
  if (token === 'valido-admin') return { uid: 'u1', email: 'a@a.com', role: 'ADMIN' };
  if (token === 'valido-cliente') return { uid: 'u2', email: 'c@c.com' };
  if (token === 'valido-raro') return { uid: 'u3', email: 'r@r.com', role: 'hacker' };
  if (token === 'rompe-servidor') throw new Error('Faltan credenciales de Firebase');
  throw Object.assign(new Error('x'), { code: 'auth/argument-error' });
}

async function listen(expressApp) {
  const server = expressApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

describe('Autenticación y roles', () => {
  let server;
  let baseUrl;
  let roleServer;
  let roleUrl;

  before(async () => {
    setTokenVerifier(fakeVerifier);
    setDbForTests(createFakeFirestore());
    ({ server, baseUrl } = await listen(app));

    // Mini app solo para probar requireRole.
    const roleApp = express();
    roleApp.get('/solo-admin', auth, requireRole(ROLES.ADMIN), (req, res) =>
      res.json({ ok: true }),
    );
    roleApp.use(errorHandler);
    ({ server: roleServer, baseUrl: roleUrl } = await listen(roleApp));
  });

  after(async () => {
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => roleServer.close(resolve));
  });

  describe('auth', () => {
    it('sin cabecera Authorization responde 401 NO_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`);
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, 'NO_TOKEN');
    });

    it('con "Bearer" vacío responde 401 NO_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, { headers: { Authorization: 'Bearer ' } });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, 'NO_TOKEN');
    });

    it('con un esquema distinto de Bearer responde 401 NO_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, 'NO_TOKEN');
    });

    it('con un token inválido responde 401 INVALID_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, bearer('token-falso'));
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'INVALID_TOKEN');
      assert.equal(typeof body.error.message, 'string');
    });

    it('un error que no es de Firebase Auth responde 500 INTERNAL_ERROR', async (t) => {
      // El errorHandler hace console.error de los 500: lo silenciamos en este caso.
      t.mock.method(console, 'error', () => {});
      const res = await fetch(`${baseUrl}/api/users/me`, bearer('rompe-servidor'));
      assert.equal(res.status, 500);
      assert.equal((await res.json()).error.code, 'INTERNAL_ERROR');
    });
  });

  describe('GET /api/users/me', () => {
    it('cliente sin rol en el token: 200 con role CLIENT y companyId null', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, bearer('valido-cliente'));
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), {
        uid: 'u2',
        email: 'c@c.com',
        role: 'CLIENT',
        companyId: null,
        nombre: null,
        apellidos: null,
        telefono: null,
      });
    });

    it('esquema "bearer" en minúsculas también vale', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, {
        headers: { Authorization: 'bearer valido-cliente' },
      });
      assert.equal(res.status, 200);
    });

    it('admin: 200 con role ADMIN', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, bearer('valido-admin'));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.uid, 'u1');
      assert.equal(body.role, 'ADMIN');
    });

    it('rol desconocido en el token: se trata como CLIENT', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, bearer('valido-raro'));
      assert.equal(res.status, 200);
      assert.equal((await res.json()).role, 'CLIENT');
    });
  });

  describe('requireRole', () => {
    it('cliente en ruta de admin: 403 FORBIDDEN', async () => {
      const res = await fetch(`${roleUrl}/solo-admin`, bearer('valido-cliente'));
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, 'FORBIDDEN');
    });

    it('rol desconocido en ruta de admin: 403 FORBIDDEN', async () => {
      const res = await fetch(`${roleUrl}/solo-admin`, bearer('valido-raro'));
      assert.equal(res.status, 403);
    });

    it('admin en ruta de admin: 200', async () => {
      const res = await fetch(`${roleUrl}/solo-admin`, bearer('valido-admin'));
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
    });

    it('sin token en ruta de admin: 401 NO_TOKEN', async () => {
      const res = await fetch(`${roleUrl}/solo-admin`);
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, 'NO_TOKEN');
    });
  });
});
