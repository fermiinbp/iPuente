// Test de integración: GET y PATCH /api/users/me con el verificador de tokens, Firebase Auth y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as userModel from '../../src/models/userModel.js';
import { setAuthClientForTests } from '../../src/services/authService.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const TOKENS = {
  cliente: { uid: 'u1', email: 'ana@ejemplo.com' },
  google: { uid: 'u3', email: 'g@ejemplo.com', name: 'Gael Pérez' },
  empresa: { uid: 'u2', email: 'emp@ejemplo.com', role: 'COMPANY', companyId: 'c1' },
};

describe('Perfil del usuario (/api/users/me)', () => {
  let server;
  let baseUrl;
  let fakeAuth;

  async function call(method, token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}/api/users/me`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }
  const get = (token) => call('GET', token);
  const patch = (token, body) => call('PATCH', token, body);

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    fakeAuth = {
      updated: [],
      fail: null,
      claims: {},
      async getUser(uid) {
        return { uid, customClaims: fakeAuth.claims[uid] ?? {} };
      },
      async updateUser(uid, data) {
        if (fakeAuth.fail) throw fakeAuth.fail;
        fakeAuth.updated.push({ uid, ...data });
      },
    };
    setAuthClientForTests(fakeAuth);
    setTokenVerifier(async (token) => {
      if (TOKENS[token]) return TOKENS[token];
      throw Object.assign(new Error('x'), { code: 'auth/argument-error' });
    });
    await userModel.create(
      {
        name: 'Ana',
        surname: 'López',
        phone: '612345678',
        email: 'ana@ejemplo.com',
        role: 'CLIENT',
      },
      { id: 'u1' },
    );
  });

  after(async () => {
    setAuthClientForTests(null);
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET devuelve los datos de la ficha', async () => {
    const { status, body } = await get('cliente');
    assert.equal(status, 200);
    assert.deepEqual(body, {
      uid: 'u1',
      email: 'ana@ejemplo.com',
      role: 'CLIENT',
      companyId: null,
      nombre: 'Ana',
      apellidos: 'López',
      telefono: '612345678',
    });
  });

  it('GET sin ficha devuelve nombre, apellidos y telefono a null', async () => {
    const { status, body } = await get('empresa');
    assert.equal(status, 200);
    assert.equal(body.nombre, null);
    assert.equal(body.apellidos, null);
    assert.equal(body.telefono, null);
    assert.equal(body.role, 'COMPANY');
  });

  it('PATCH sin token: 401', async () => {
    const { status } = await patch(null, { nombre: 'Eva' });
    assert.equal(status, 401);
  });

  it('PATCH edita lo suyo: 200, cambia Firestore y displayName', async () => {
    const { status, body } = await patch('cliente', {
      nombre: '  Eva ',
      telefono: '654 321 987',
    });
    assert.equal(status, 200);
    assert.equal(body.nombre, 'Eva');
    assert.equal(body.apellidos, 'López');
    assert.equal(body.telefono, '654321987');
    const user = await userModel.findById('u1');
    assert.equal(user.name, 'Eva');
    assert.equal(user.phone, '654321987');
    assert.deepEqual(fakeAuth.updated, [{ uid: 'u1', displayName: 'Eva López' }]);
  });

  it('PATCH ignora role, email y companyId del body', async () => {
    const { status, body } = await patch('cliente', {
      nombre: 'Eva',
      role: 'ADMIN',
      email: 'otro@x.com',
      companyId: 'c9',
    });
    assert.equal(status, 200);
    assert.equal(body.role, 'CLIENT');
    assert.equal(body.email, 'ana@ejemplo.com');
    assert.equal(body.companyId, null);
    const user = await userModel.findById('u1');
    assert.equal(user.role, 'CLIENT');
    assert.equal(user.email, 'ana@ejemplo.com');
    assert.equal(user.companyId, undefined);
    assert.equal(fakeAuth.updated.length, 1);
    assert.deepEqual(Object.keys(fakeAuth.updated[0]).sort(), ['displayName', 'uid']);
  });

  it('PATCH con teléfono inválido: 400', async () => {
    const { status, body } = await patch('cliente', { telefono: '123' });
    assert.equal(status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('PATCH con body vacío o solo claves ignoradas: 400', async () => {
    for (const payload of [{}, { role: 'ADMIN' }]) {
      const { status, body } = await patch('cliente', payload);
      assert.equal(status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('PATCH con nombre vacío o nulo: 400', async () => {
    assert.equal((await patch('cliente', { nombre: '   ' })).status, 400);
    assert.equal((await patch('cliente', { nombre: null })).status, 400);
  });

  it('PATCH sin ficha la crea con el email y el rol del token', async () => {
    const { status, body } = await patch('empresa', { nombre: 'Luis', role: 'ADMIN' });
    assert.equal(status, 200);
    assert.equal(body.nombre, 'Luis');
    assert.equal(body.role, 'COMPANY');
    const user = await userModel.findById('u2');
    assert.equal(user.name, 'Luis');
    assert.equal(user.email, 'emp@ejemplo.com');
    assert.equal(user.role, 'COMPANY');
    assert.deepEqual(fakeAuth.updated, [{ uid: 'u2', displayName: 'Luis' }]);
  });

  it('PATCH con solo telefono no llama a updateUser', async () => {
    const { status } = await patch('cliente', { telefono: '699111222' });
    assert.equal(status, 200);
    assert.equal(fakeAuth.updated.length, 0);
  });

  it('PATCH sin ficha y sin nombre usa el name del token y el rol de los claims', async () => {
    fakeAuth.claims.u3 = { role: 'COMPANY' };
    const { status, body } = await patch('google', { telefono: '699111222' });
    assert.equal(status, 200);
    assert.equal(body.nombre, 'Gael Pérez');
    const user = await userModel.findById('u3');
    assert.equal(user.name, 'Gael Pérez');
    assert.equal(user.role, 'COMPANY');
    assert.equal(fakeAuth.updated.length, 0);
  });

  it('PATCH no toca el rol de una ficha existente', async () => {
    fakeAuth.claims.u1 = { role: 'ADMIN' };
    await patch('cliente', { nombre: 'Eva' });
    assert.equal((await userModel.findById('u1')).role, 'CLIENT');
  });

  it('PATCH con caracteres de control o bidi en el nombre: 400', async () => {
    for (const nombre of ['Eva‮atse', 'Eva\nLópez', 'Eva\u0000']) {
      const { status } = await patch('cliente', { nombre });
      assert.equal(status, 400);
    }
    assert.equal((await patch('cliente', { nombre: 'Eva‍x' })).status, 200);
  });

  it('PATCH borra el teléfono con null', async () => {
    const { status, body } = await patch('cliente', { telefono: null });
    assert.equal(status, 200);
    assert.equal(body.telefono, null);
    assert.equal((await userModel.findById('u1')).phone, null);
  });

  it('PATCH borra los apellidos con null y quita el apellido del displayName', async () => {
    const { status, body } = await patch('cliente', { apellidos: null });
    assert.equal(status, 200);
    assert.equal(body.apellidos, null);
    assert.deepEqual(fakeAuth.updated, [{ uid: 'u1', displayName: 'Ana' }]);
  });

  it('PATCH si Auth falla: 200 con aviso y datos guardados', async (t) => {
    t.mock.method(console, 'error', () => {});
    fakeAuth.fail = Object.assign(new Error('x'), { code: 'auth/internal-error' });
    const { status, body } = await patch('cliente', { nombre: 'Eva' });
    assert.equal(status, 200);
    assert.equal(typeof body.aviso, 'string');
    assert.equal(body.nombre, 'Eva');
    assert.equal((await userModel.findById('u1')).name, 'Eva');
  });
});
