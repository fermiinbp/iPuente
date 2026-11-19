// Tests unitarios de requireApprovedCompany con Firestore sustituido por un doble.
import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { requireApprovedCompany } from '../../src/middlewares/requireApprovedCompany.js';
import * as companyModel from '../../src/models/companyModel.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';

// Ejecuta el middleware y devuelve lo que pasó al llamar a next.
async function run(req) {
  let arg = 'no-llamado';
  await requireApprovedCompany(req, {}, (value) => {
    arg = value;
  });
  return arg;
}

describe('requireApprovedCompany', () => {
  beforeEach(() => setDbForTests(createFakeFirestore()));
  after(() => setDbForTests(null));

  it('deja pasar a una empresa aprobada y la deja en req.company', async () => {
    const id = await companyModel.create({ name: 'A', status: 'APPROVED', verified: true });
    const req = { user: { uid: 'u1', companyId: id } };
    assert.equal(await run(req), undefined);
    assert.equal(req.company.id, id);
  });

  it('403 COMPANY_NOT_APPROVED si está pendiente', async () => {
    const id = await companyModel.create({ name: 'A', status: 'PENDING', verified: false });
    const err = await run({ user: { uid: 'u1', companyId: id } });
    assert.equal(err.status, 403);
    assert.equal(err.code, 'COMPANY_NOT_APPROVED');
  });

  it('403 si está rechazada', async () => {
    const id = await companyModel.create({ name: 'A', status: 'REJECTED', verified: false });
    const err = await run({ user: { uid: 'u1', companyId: id } });
    assert.equal(err.status, 403);
    assert.equal(err.code, 'COMPANY_NOT_APPROVED');
  });

  it('403 si el usuario no tiene companyId', async () => {
    const err = await run({ user: { uid: 'u1', companyId: null } });
    assert.equal(err.status, 403);
  });

  it('403 si la empresa no existe', async () => {
    const err = await run({ user: { uid: 'u1', companyId: 'no-existe' } });
    assert.equal(err.status, 403);
  });

  it('401 NO_TOKEN si no hay req.user', async () => {
    const err = await run({});
    assert.equal(err.status, 401);
    assert.equal(err.code, 'NO_TOKEN');
  });
});
