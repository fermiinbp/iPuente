// Test de integración: registro de cliente y empresa (POST /api/auth/register/*) y GET /api/companies/me,
// con Firebase Auth, el verificador de tokens y Firestore sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { db, setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as companyModel from '../../src/models/companyModel.js';
import * as companyTaxIdModel from '../../src/models/companyTaxIdModel.js';
import * as userModel from '../../src/models/userModel.js';
import { setAuthClientForTests } from '../../src/services/authService.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

const PASSWORD = 'contraseña-secreta-123';
const CLIENTE = { email: 'Ana@Ejemplo.com', password: PASSWORD, nombre: 'Ana López' };
const EMPRESA = {
  email: 'empresa@ejemplo.com',
  password: PASSWORD,
  nombre: 'Luis Pérez',
  nombreEmpresa: 'Oficinas Sevilla SL',
  cif: 'b-1234 5674',
  contacto: 'Marta Ruiz',
  telefono: '954 123 456',
};

describe('Registro de clientes y empresas', () => {
  let server;
  let baseUrl;
  let fakeAuth;

  // Doble de Firebase Auth que registra las llamadas.
  function createFakeAuth() {
    const fake = {
      created: [],
      claims: {},
      deleted: [],
      failCreate: null,
      failClaims: null,
      existing: {},
      async getUserByEmail(email) {
        const user = fake.existing[email];
        if (!user) throw Object.assign(new Error('no existe'), { code: 'auth/user-not-found' });
        return user;
      },
      async createUser(data) {
        if (fake.failCreate) throw fake.failCreate;
        const uid = `uid${fake.created.length + 1}`;
        fake.created.push({ uid, ...data });
        return { uid };
      },
      async setCustomUserClaims(uid, claims) {
        if (fake.failClaims) throw fake.failClaims;
        fake.claims[uid] = claims;
      },
      async deleteUser(uid) {
        fake.deleted.push(uid);
      },
    };
    return fake;
  }

  async function post(path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  }
  const registrarCliente = (body) => post('/api/auth/register/client', body);
  const registrarEmpresa = (body) => post('/api/auth/register/company', body);

  async function get(path, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return { status: res.status, body: await res.json() };
  }

  // Todo lo que hay guardado de empresas, para comprobar que no hay secretos.
  const dump = async () =>
    JSON.stringify([
      await companyModel.listByVerified(false),
      await companyModel.listByVerified(true),
    ]);

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(() => {
    setDbForTests(createFakeFirestore());
    fakeAuth = createFakeAuth();
    setAuthClientForTests(fakeAuth);
    setTokenVerifier(null);
  });

  after(async () => {
    setAuthClientForTests(null);
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('POST /api/auth/register/client', () => {
    it('crea el cliente: 201 con uid, claims CLIENT y ficha en users', async () => {
      const { status, body, text } = await registrarCliente(CLIENTE);
      assert.equal(status, 201);
      assert.deepEqual(body, { uid: 'uid1' });
      assert.deepEqual(fakeAuth.claims.uid1, { role: 'CLIENT' });
      const user = await userModel.findById('uid1');
      assert.equal(user.name, 'Ana López');
      assert.equal(user.email, 'ana@ejemplo.com');
      assert.equal(user.role, 'CLIENT');
      assert.ok(!text.includes(PASSWORD));
      assert.ok(!JSON.stringify(user).includes(PASSWORD));
    });

    it('ignora role en el body: sigue siendo CLIENT', async () => {
      for (const role of ['ADMIN', 'COMPANY']) {
        const { status } = await registrarCliente({ ...CLIENTE, email: `${role}@e.com`, role });
        assert.equal(status, 201);
      }
      assert.deepEqual(fakeAuth.claims.uid1, { role: 'CLIENT' });
      assert.deepEqual(fakeAuth.claims.uid2, { role: 'CLIENT' });
      assert.equal((await userModel.findById('uid1')).role, 'CLIENT');
      assert.equal((await userModel.findById('uid2')).role, 'CLIENT');
    });

    it('409 EMAIL_EXISTS si el email ya existe', async () => {
      fakeAuth.failCreate = Object.assign(new Error('x'), { code: 'auth/email-already-exists' });
      const { status, body } = await registrarCliente(CLIENTE);
      assert.equal(status, 409);
      assert.equal(body.error.code, 'EMAIL_EXISTS');
    });

    it('rollback: si falla Firestore borra el usuario de Auth y responde 500 sin detalles', async () => {
      // La ficha ya existe, así que users.create falla con ALREADY_EXISTS.
      await userModel.create({ name: 'x', email: 'x', role: 'CLIENT' }, { id: 'uid1' });
      const { status, body, text } = await registrarCliente(CLIENTE);
      assert.equal(status, 500);
      assert.equal(body.error.code, 'INTERNAL_ERROR');
      assert.ok(!/ALREADY_EXISTS|users\/uid1/.test(text));
      assert.deepEqual(fakeAuth.deleted, ['uid1']);
    });

    it('rollback: si falla setCustomUserClaims borra el usuario de Auth y no crea la ficha', async () => {
      fakeAuth.failClaims = new Error('claims rotos');
      const { status, text } = await registrarCliente(CLIENTE);
      assert.equal(status, 500);
      assert.ok(!text.includes('claims rotos'));
      assert.deepEqual(fakeAuth.deleted, ['uid1']);
      assert.equal(await userModel.findById('uid1'), null);
    });

    it('400 VALIDATION_ERROR con email inválido, password corta o nombre vacío', async () => {
      const casos = [
        { ...CLIENTE, email: 'no-es-email' },
        { ...CLIENTE, password: '1234567' },
        { ...CLIENTE, nombre: '   ' },
        { email: CLIENTE.email },
      ];
      for (const caso of casos) {
        const { status, body } = await registrarCliente(caso);
        assert.equal(status, 400);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      }
      assert.equal(fakeAuth.created.length, 0);
    });
  });

  describe('POST /api/auth/register/company', () => {
    it('crea la empresa pendiente con su OWNER y claims COMPANY', async () => {
      const { status, body, text } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 201);
      assert.equal(body.uid, 'uid1');
      assert.equal(body.estado, 'pendiente');
      assert.ok(body.companyId);
      assert.deepEqual(fakeAuth.claims.uid1, {
        role: 'COMPANY',
        companyId: body.companyId,
        companyApproved: false,
      });
      const company = await companyModel.findById(body.companyId);
      assert.equal(company.status, 'PENDING');
      assert.equal(company.verified, false);
      assert.equal(company.ownerUid, 'uid1');
      assert.equal(company.taxId, 'B12345674');
      assert.equal(company.name, 'Oficinas Sevilla SL');
      assert.equal((await companyModel.findMember(body.companyId, 'uid1')).role, 'OWNER');
      assert.equal((await userModel.findById('uid1')).role, 'COMPANY');
      assert.ok(!text.includes(PASSWORD));
      assert.ok(!(await dump()).includes(PASSWORD));
    });

    it('ignora status, verified, estado y role del body: sigue PENDING', async () => {
      const { status, body } = await registrarEmpresa({
        ...EMPRESA,
        status: 'APPROVED',
        verified: true,
        estado: 'aprobada',
        role: 'ADMIN',
      });
      assert.equal(status, 201);
      assert.equal(body.estado, 'pendiente');
      const company = await companyModel.findById(body.companyId);
      assert.equal(company.status, 'PENDING');
      assert.equal(company.verified, false);
      assert.equal(fakeAuth.claims.uid1.role, 'COMPANY');
    });

    it('409 EMAIL_EXISTS si el email ya existe', async () => {
      fakeAuth.failCreate = Object.assign(new Error('x'), { code: 'auth/email-already-exists' });
      const { status, body } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 409);
      assert.equal(body.error.code, 'EMAIL_EXISTS');
    });

    it('409 COMPANY_EXISTS si el CIF ya existe y no crea el usuario', async () => {
      await registrarEmpresa(EMPRESA);
      const { status, body } = await registrarEmpresa({
        ...EMPRESA,
        email: 'otra@ejemplo.com',
        cif: 'B12345674',
      });
      assert.equal(status, 409);
      assert.equal(body.error.code, 'COMPANY_EXISTS');
      assert.equal(fakeAuth.created.length, 1);
    });

    it('crea el índice companyTaxIds/{cif} con el id de la empresa', async () => {
      const { body } = await registrarEmpresa(EMPRESA);
      const index = await companyTaxIdModel.findById('B12345674');
      assert.equal(index.companyId, body.companyId);
    });

    it('dos registros simultáneos con el mismo CIF: uno 201 y otro 409 COMPANY_EXISTS', async () => {
      const [a, b] = await Promise.all([
        registrarEmpresa(EMPRESA),
        registrarEmpresa({ ...EMPRESA, email: 'otra@ejemplo.com' }),
      ]);
      assert.deepEqual([a.status, b.status].sort(), [201, 409]);
      const perdedor = a.status === 409 ? a : b;
      assert.equal(perdedor.body.error.code, 'COMPANY_EXISTS');
      assert.equal(fakeAuth.created.length, 1);
      assert.equal((await companyModel.listByVerified(false)).length, 1);
    });

    it('CIF huérfano sin companyId y de hace más de 10 minutos: se sobrescribe y registra', async () => {
      const old = new Date(Date.now() - 11 * 60 * 1000);
      await db()
        .collection('companyTaxIds')
        .doc('B12345674')
        .set({ taxId: 'B12345674', createdAt: old });
      const { status, body } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 201);
      assert.equal((await companyTaxIdModel.findById('B12345674')).companyId, body.companyId);
    });

    it('CIF reservado hace menos de 10 minutos sin companyId: 409 COMPANY_EXISTS', async () => {
      await companyTaxIdModel.overwrite('B12345674', { taxId: 'B12345674' });
      const { status, body } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 409);
      assert.equal(body.error.code, 'COMPANY_EXISTS');
    });

    it('CIF cuyo companyId apunta a una empresa inexistente: se sobrescribe y registra', async () => {
      await companyTaxIdModel.overwrite('B12345674', { taxId: 'B12345674', companyId: 'fantasma' });
      const { status, body } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 201);
      assert.equal((await companyTaxIdModel.findById('B12345674')).companyId, body.companyId);
    });

    it('409 EMAIL_IS_CLIENT si el email es de un cliente (claim) y no crea nada', async () => {
      fakeAuth.existing[EMPRESA.email] = { uid: 'cli1', customClaims: { role: 'CLIENT' } };
      const { status, body } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 409);
      assert.equal(body.error.code, 'EMAIL_IS_CLIENT');
      assert.match(body.error.message, /cuenta de cliente/);
      assert.equal(fakeAuth.created.length, 0);
      assert.equal(await companyTaxIdModel.findById('B12345674'), null);
    });

    it('409 EMAIL_IS_CLIENT si users dice que es cliente', async () => {
      fakeAuth.existing[EMPRESA.email] = { uid: 'cli1' };
      await userModel.create({ name: 'x', email: EMPRESA.email, role: 'CLIENT' }, { id: 'cli1' });
      const { status, body } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 409);
      assert.equal(body.error.code, 'EMAIL_IS_CLIENT');
    });

    it('rollback: si falla Auth o Firestore se borra el índice de CIF', async () => {
      fakeAuth.failCreate = Object.assign(new Error('x'), { code: 'auth/email-already-exists' });
      await registrarEmpresa(EMPRESA);
      assert.equal(await companyTaxIdModel.findById('B12345674'), null);
      fakeAuth.failCreate = null;
      fakeAuth.failClaims = new Error('claims rotos');
      await registrarEmpresa(EMPRESA);
      assert.equal(await companyTaxIdModel.findById('B12345674'), null);
    });

    it('rollback: si falla Firestore borra empresa, miembro y usuario; 500 sin detalles', async () => {
      await userModel.create({ name: 'x', email: 'x', role: 'CLIENT' }, { id: 'uid1' });
      const { status, body, text } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 500);
      assert.equal(body.error.code, 'INTERNAL_ERROR');
      assert.ok(!/ALREADY_EXISTS/.test(text));
      assert.deepEqual(fakeAuth.deleted, ['uid1']);
      assert.equal(await companyModel.findByTaxId('B12345674'), null);
      assert.deepEqual(await companyModel.listByVerified(false), []);
    });

    it('rollback: si falla setCustomUserClaims no queda empresa ni miembro', async () => {
      fakeAuth.failClaims = new Error('claims rotos');
      const { status, text } = await registrarEmpresa(EMPRESA);
      assert.equal(status, 500);
      assert.ok(!text.includes('claims rotos'));
      assert.deepEqual(fakeAuth.deleted, ['uid1']);
      assert.equal(await companyModel.findByTaxId('B12345674'), null);
      assert.deepEqual(await companyModel.listByVerified(false), []);
    });

    it('400 VALIDATION_ERROR con datos inválidos', async () => {
      const casos = {
        'email inválido': { email: 'nope' },
        'password de 7': { password: '1234567' },
        'nombre vacío': { nombre: '' },
        'nombre de empresa vacío': { nombreEmpresa: ' ' },
        'contacto vacío': { contacto: '' },
        'CIF con formato inválido': { cif: '12345' },
        'CIF con dígito de control erróneo': { cif: 'B12345675' },
        'teléfono de 8 dígitos': { telefono: '95412345' },
        'teléfono que empieza por 5': { telefono: '554123456' },
      };
      for (const [nombre, cambio] of Object.entries(casos)) {
        const { status, body } = await registrarEmpresa({ ...EMPRESA, ...cambio });
        assert.equal(status, 400, nombre);
        assert.equal(body.error.code, 'VALIDATION_ERROR', nombre);
      }
      assert.equal(fakeAuth.created.length, 0);
    });
  });

  describe('GET /api/companies/me', () => {
    const tokens = {
      cliente: { uid: 'u1', role: 'CLIENT' },
      pendiente: { uid: 'u2', role: 'COMPANY', companyId: 'c-pend' },
      aprobada: { uid: 'u3', role: 'COMPANY', companyId: 'c-ok' },
      fantasma: { uid: 'u4', role: 'COMPANY', companyId: 'c-no-existe' },
    };

    beforeEach(async () => {
      setTokenVerifier(async (token) => tokens[token]);
      await companyModel.create(
        { name: 'Pend SL', taxId: 'B12345674', status: 'PENDING', verified: false },
        { id: 'c-pend' },
      );
      await companyModel.create(
        { name: 'Ok SL', taxId: 'A58818501', status: 'APPROVED', verified: true },
        { id: 'c-ok' },
      );
    });

    it('401 sin token', async () => {
      const { status, body } = await get('/api/companies/me');
      assert.equal(status, 401);
      assert.equal(body.error.code, 'NO_TOKEN');
    });

    it('403 con rol CLIENT', async () => {
      const { status, body } = await get('/api/companies/me', 'cliente');
      assert.equal(status, 403);
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    it('200 con la empresa pendiente', async () => {
      const { status, body } = await get('/api/companies/me', 'pendiente');
      assert.equal(status, 200);
      assert.equal(body.id, 'c-pend');
      assert.equal(body.name, 'Pend SL');
      assert.equal(body.estado, 'pendiente');
    });

    it('200 con la empresa aprobada', async () => {
      const { status, body } = await get('/api/companies/me', 'aprobada');
      assert.equal(status, 200);
      assert.equal(body.estado, 'aprobada');
    });

    it('404 si la empresa no existe', async () => {
      const { status, body } = await get('/api/companies/me', 'fantasma');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
    });
  });
});
