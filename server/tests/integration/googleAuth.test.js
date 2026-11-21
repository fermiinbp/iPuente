// Test de integración: POST /api/auth/google con el verificador de tokens, Firebase Auth y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import { setRateLimitForTests } from '../../src/middlewares/rateLimit.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as userModel from '../../src/models/userModel.js';
import { setAuthClientForTests } from '../../src/services/authService.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const google = (uid, extra = {}) => ({
  uid,
  email: `${uid}@ejemplo.com`,
  name: 'Gael Pérez',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
  ...extra,
});

const TOKENS = {
  nuevo: google('u-nuevo'),
  repetido: google('u-rep'),
  // El token dice COMPANY, pero lo que cuenta es el claim fresco de Auth.
  empresa: google('u-emp', { role: 'COMPANY', companyId: 'c1' }),
  admin: google('u-adm', { role: 'ADMIN' }),
  demo: google('u-demo'),
  password: google('u-pw', { firebase: { sign_in_provider: 'password' } }),
  sinVerificar: google('u-nv', { email_verified: false }),
  sinProveedor: { uid: 'u-sp', email: 'sp@ejemplo.com', email_verified: true },
  fichaEmpresa: google('u-fe'),
  dueno: google('u-dueno'),
  fichaCliente: google('u-fc'),
  claimSinFicha: google('u-csf'),
  adminSinFicha: google('u-asf'),
  bidi: google('u-bidi', { name: '\u202EGael\u2066 Pérez\u2069' }),
  control: google('u-ctl', { name: 'Gael\u0000\n   \tPérez' }),
  largo: google('u-largo', { name: 'ñ'.repeat(500) }),
  emoji: google('u-emoji', { name: '😀'.repeat(300) }),
  vacio: google('u-vacio', { name: ' \u202E\u0000 ' }),
  carrera: google('u-carrera'),
  claimInvalido: google('u-inv'),
  claimInvalidoEmpresa: google('u-inve'),
};

describe('Alta con Google (POST /api/auth/google)', () => {
  let server;
  let baseUrl;
  let fakeAuth;

  async function call(token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(() => {
    setDbForTests(createFakeFirestore());
    fakeAuth = {
      claims: {},
      writes: [],
      failClaims: false,
      async getUser(uid) {
        return { uid, customClaims: fakeAuth.claims[uid] };
      },
      async setCustomUserClaims(uid, claims) {
        if (fakeAuth.failClaims) {
          throw Object.assign(new Error('detalle-interno-secreto'), {
            code: 'auth/internal-error',
          });
        }
        fakeAuth.writes.push({ uid, claims });
        fakeAuth.claims[uid] = claims;
      },
    };
    setAuthClientForTests(fakeAuth);
    setTokenVerifier(async (token) => {
      if (TOKENS[token]) return TOKENS[token];
      throw Object.assign(new Error('x'), { code: 'auth/argument-error' });
    });
  });

  after(async () => {
    setAuthClientForTests(null);
    setTokenVerifier(null);
    setRateLimitForTests(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  it('sin token: 401', async () => {
    assert.equal((await call(null)).status, 401);
  });

  it('proveedor que no es Google: 403 GOOGLE_REQUIRED, sin escribir', async () => {
    for (const token of ['password', 'sinProveedor']) {
      const { status, body } = await call(token);
      assert.equal(status, 403);
      assert.equal(body.error.code, 'GOOGLE_REQUIRED');
    }
    assert.equal(await userModel.findById('u-pw'), null);
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('correo sin verificar: 403 EMAIL_NOT_VERIFIED, sin escribir', async () => {
    const { status, body } = await call('sinVerificar');
    assert.equal(status, 403);
    assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(await userModel.findById('u-nv'), null);
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('alta nueva: 201, crea la ficha CLIENT y el claim, pide refrescar el token', async () => {
    const { status, body } = await call('nuevo');
    assert.equal(status, 201);
    assert.deepEqual(body, { uid: 'u-nuevo', rol: 'CLIENT', creado: true, refrescarToken: true });
    const user = await userModel.findById('u-nuevo');
    assert.equal(user.role, 'CLIENT');
    assert.equal(user.email, 'u-nuevo@ejemplo.com');
    assert.equal(user.name, 'Gael Pérez');
    assert.deepEqual(fakeAuth.writes, [{ uid: 'u-nuevo', claims: { role: 'CLIENT' } }]);
  });

  it('repetir la llamada: 200 sin escribir el claim', async () => {
    assert.equal((await call('repetido')).status, 201);
    fakeAuth.writes.length = 0;
    const { status, body } = await call('repetido');
    assert.equal(status, 200);
    assert.deepEqual(body, { uid: 'u-rep', rol: 'CLIENT', creado: false, refrescarToken: false });
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('dos llamadas simultáneas: una ficha y un único rol CLIENT', async () => {
    const results = await Promise.all([call('nuevo'), call('nuevo')]);
    assert.ok(results.every((r) => [200, 201].includes(r.status)));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal((await userModel.findById('u-nuevo')).role, 'CLIENT');
    assert.ok(fakeAuth.writes.every((w) => w.claims.role === 'CLIENT'));
    assert.deepEqual(fakeAuth.claims['u-nuevo'], { role: 'CLIENT' });
  });

  it('una empresa no cambia: conserva ficha y claims', async () => {
    fakeAuth.claims['u-emp'] = { role: 'COMPANY', companyId: 'c1', companyApproved: true };
    await userModel.create({ email: 'e@e.com', role: 'COMPANY', name: 'Emp' }, { id: 'u-emp' });
    const { status, body } = await call('empresa');
    assert.equal(status, 200);
    assert.deepEqual(body, { uid: 'u-emp', rol: 'COMPANY', creado: false, refrescarToken: false });
    assert.equal((await userModel.findById('u-emp')).role, 'COMPANY');
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('un admin no cambia: conserva ficha y claims', async () => {
    fakeAuth.claims['u-adm'] = { role: 'ADMIN' };
    await userModel.create({ email: 'a@a.com', role: 'ADMIN', name: 'Adm' }, { id: 'u-adm' });
    const { status, body } = await call('admin');
    assert.equal(status, 200);
    assert.equal(body.rol, 'ADMIN');
    assert.equal(body.refrescarToken, false);
    assert.equal((await userModel.findById('u-adm')).role, 'ADMIN');
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('claim de admin sin ficha: crea la ficha con ese rol y no toca el claim', async () => {
    fakeAuth.claims['u-asf'] = { role: 'ADMIN' };
    const { status, body } = await call('adminSinFicha');
    assert.equal(status, 201);
    assert.deepEqual(body, { uid: 'u-asf', rol: 'ADMIN', creado: true, refrescarToken: false });
    assert.equal((await userModel.findById('u-asf')).role, 'ADMIN');
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('claim de cliente sin ficha: crea la ficha y no toca el claim', async () => {
    fakeAuth.claims['u-csf'] = { role: 'CLIENT' };
    const { status, body } = await call('claimSinFicha');
    assert.equal(status, 201);
    assert.equal(body.refrescarToken, false);
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('ficha COMPANY sin claim: 409 ACCOUNT_INCONSISTENT sin escribir', async () => {
    await userModel.create({ email: 'f@e.com', role: 'COMPANY' }, { id: 'u-fe' });
    const { status, body } = await call('fichaEmpresa');
    assert.equal(status, 409);
    assert.equal(body.error.code, 'ACCOUNT_INCONSISTENT');
    assert.equal((await userModel.findById('u-fe')).role, 'COMPANY');
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('ownerUid de una empresa sin claim: 409 ACCOUNT_INCONSISTENT y no crea ficha', async () => {
    await companyModel.create({ name: 'Emp', ownerUid: 'u-dueno', status: 'PENDING' });
    const { status, body } = await call('dueno');
    assert.equal(status, 409);
    assert.equal(body.error.code, 'ACCOUNT_INCONSISTENT');
    assert.equal(await userModel.findById('u-dueno'), null);
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('ficha CLIENT sin claim: repara el claim y pide refrescar', async () => {
    await userModel.create({ email: 'c@c.com', role: 'CLIENT', name: 'Cli' }, { id: 'u-fc' });
    const { status, body } = await call('fichaCliente');
    assert.equal(status, 200);
    assert.deepEqual(body, { uid: 'u-fc', rol: 'CLIENT', creado: false, refrescarToken: true });
    assert.deepEqual(fakeAuth.claims['u-fc'], { role: 'CLIENT' });
  });

  it('conserva los claims existentes (demo) al asignar CLIENT', async () => {
    fakeAuth.claims['u-demo'] = { demo: true };
    const { status } = await call('demo');
    assert.equal(status, 201);
    assert.deepEqual(fakeAuth.claims['u-demo'], { demo: true, role: 'CLIENT' });
  });

  it('un body con claves: 400 de validación, sin escribir', async () => {
    for (const body of [{ role: 'ADMIN' }, { rol: 'COMPANY' }, { x: 1 }, [1]]) {
      const res = await call('nuevo', body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(await userModel.findById('u-nuevo'), null);
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('un body vacío {} vale', async () => {
    assert.equal((await call('nuevo', {})).status, 201);
  });

  it('no se puede elegir rol: ni por body ni por el rol del token', async () => {
    const { status } = await call('nuevo', { role: 'ADMIN' });
    assert.equal(status, 400);
    // El token dice COMPANY pero Auth no tiene claim: no se concede nada y es inconsistente solo si hay ficha.
    const res = await call('empresa');
    assert.equal(res.body.rol, 'CLIENT');
    assert.equal((await userModel.findById('u-emp')).role, 'CLIENT');
  });

  it('si falla setCustomUserClaims: 500 sin detalles y la siguiente llamada lo repara', async () => {
    fakeAuth.failClaims = true;
    const first = await call('nuevo');
    assert.equal(first.status, 500);
    assert.ok(!JSON.stringify(first.body).includes('detalle-interno-secreto'));
    assert.equal((await userModel.findById('u-nuevo')).role, 'CLIENT');

    fakeAuth.failClaims = false;
    const second = await call('nuevo');
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, {
      uid: 'u-nuevo',
      rol: 'CLIENT',
      creado: false,
      refrescarToken: true,
    });
    assert.deepEqual(fakeAuth.claims['u-nuevo'], { role: 'CLIENT' });
  });

  it('429 RATE_LIMITED al pasar el límite por uid', async () => {
    setRateLimitForTests({ googleAuth: { limit: 1, windowMs: 60_000 } });
    assert.equal((await call('nuevo')).status, 201);
    assert.equal((await call('nuevo')).status, 429);
    assert.equal((await call('repetido')).status, 201);
    setRateLimitForTests(null);
  });

  it('verifyIdToken se llama con checkRevoked = true', async () => {
    const calls = [];
    setTokenVerifier(async (token, checkRevoked) => {
      calls.push(checkRevoked);
      return TOKENS[token];
    });
    assert.equal((await call('nuevo')).status, 201);
    assert.deepEqual(calls, [true]);
  });

  it('token revocado o cuenta desactivada: 401', async () => {
    for (const code of ['auth/id-token-revoked', 'auth/user-disabled']) {
      setTokenVerifier(async () => {
        throw Object.assign(new Error('x'), { code });
      });
      assert.equal((await call('nuevo')).status, 401);
    }
    assert.equal(await userModel.findById('u-nuevo'), null);
  });

  it('nombre con bidi o control: se limpia y se colapsan espacios', async () => {
    await call('bidi');
    assert.equal((await userModel.findById('u-bidi')).name, 'Gael Pérez');
    await call('control');
    assert.equal((await userModel.findById('u-ctl')).name, 'Gael Pérez');
  });

  it('nombre de 500 caracteres: se corta a 100 sin partir pares sustitutos', async () => {
    await call('largo');
    assert.equal((await userModel.findById('u-largo')).name.length, 100);
    await call('emoji');
    const name = (await userModel.findById('u-emoji')).name;
    assert.equal(Array.from(name).length, 100);
    assert.equal(name, '😀'.repeat(100));
  });

  it('nombre que queda vacío: no se guarda name', async () => {
    const { status } = await call('vacio');
    assert.equal(status, 201);
    const user = await userModel.findById('u-vacio');
    assert.equal(user.role, 'CLIENT');
    assert.ok(!('name' in user));
  });

  it('carrera con make-admin: aparece ADMIN antes de escribir y no se pisa', async () => {
    let reads = 0;
    fakeAuth.getUser = async (uid) => {
      reads += 1;
      return { uid, customClaims: reads === 1 ? {} : { role: 'ADMIN', demo: true } };
    };
    const { status, body } = await call('carrera');
    assert.equal(status, 201);
    assert.deepEqual(body, { uid: 'u-carrera', rol: 'ADMIN', creado: true, refrescarToken: true });
    assert.equal(fakeAuth.writes.length, 0);
  });

  it('claim con rol inválido: se trata como sin rol, avisa solo con el uid y no escala', async () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      fakeAuth.claims['u-inv'] = { role: 'SUPERADMIN-SECRETO', demo: true };
      const { status, body } = await call('claimInvalido');
      assert.equal(status, 201);
      assert.equal(body.rol, 'CLIENT');
      assert.deepEqual(fakeAuth.claims['u-inv'], { role: 'CLIENT', demo: true });
      const logged = warn.mock.calls.map((c) => c.arguments.join(' ')).join(' ');
      assert.ok(logged.includes('u-inv'));
      assert.ok(!logged.includes('SUPERADMIN-SECRETO'));

      // Con ficha que no es CLIENT sigue siendo inconsistente.
      fakeAuth.claims['u-inve'] = { role: 'ROOT' };
      await userModel.create({ email: 'i@e.com', role: 'COMPANY' }, { id: 'u-inve' });
      const res = await call('claimInvalidoEmpresa');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'ACCOUNT_INCONSISTENT');
      assert.equal((await userModel.findById('u-inve')).role, 'COMPANY');
    } finally {
      warn.mock.restore();
    }
  });
});
