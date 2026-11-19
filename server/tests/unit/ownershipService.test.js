// Tests unitarios de ownershipService: 404 si no existe, 403 si es de otra empresa y recurso propio.
import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import {
  assertOwnedBy,
  getOwnedBuilding,
  getOwnedFloor,
  getOwnedRoom,
} from '../../src/services/ownershipService.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';

const rejects = (promise, status, code) =>
  assert.rejects(promise, (err) => err.status === status && err.code === code);

describe('ownershipService', () => {
  beforeEach(async () => {
    setDbForTests(createFakeFirestore());
    await buildingModel.create({ companyId: 'c1', name: 'E' }, { id: 'b1' });
    await floorModel.create({ companyId: 'c1', name: 'P' }, { id: 'f1' });
    await roomModel.create({ companyId: 'c1', name: 'S' }, { id: 'r1' });
  });

  after(() => setDbForTests(null));

  it('assertOwnedBy devuelve el recurso propio', () => {
    const res = { id: 'x', companyId: 'c1' };
    assert.equal(assertOwnedBy(res, 'c1'), res);
  });

  it('assertOwnedBy: 404 si no existe, 403 si es ajeno o companyId vacío', () => {
    assert.throws(
      () => assertOwnedBy(null, 'c1'),
      (e) => e.status === 404 && e.code === 'NOT_FOUND',
    );
    for (const companyId of ['c2', '', undefined, null]) {
      assert.throws(
        () => assertOwnedBy({ companyId: 'c1' }, companyId),
        (e) => e.status === 403 && e.code === 'FORBIDDEN',
      );
    }
    assert.throws(
      () => assertOwnedBy({ id: 'sin-empresa' }, undefined),
      (e) => e.status === 403,
    );
  });

  it('getOwnedBuilding, getOwnedFloor y getOwnedRoom devuelven lo propio', async () => {
    assert.equal((await getOwnedBuilding('b1', 'c1')).id, 'b1');
    assert.equal((await getOwnedFloor('f1', 'c1')).id, 'f1');
    assert.equal((await getOwnedRoom('r1', 'c1')).id, 'r1');
  });

  it('getOwned*: 403 con otra empresa', async () => {
    await rejects(getOwnedBuilding('b1', 'c2'), 403, 'FORBIDDEN');
    await rejects(getOwnedFloor('f1', 'c2'), 403, 'FORBIDDEN');
    await rejects(getOwnedRoom('r1', 'c2'), 403, 'FORBIDDEN');
  });

  it('getOwned*: 404 si no existe', async () => {
    await rejects(getOwnedBuilding('nope', 'c1'), 404, 'NOT_FOUND');
    await rejects(getOwnedFloor('nope', 'c1'), 404, 'NOT_FOUND');
    await rejects(getOwnedRoom('nope', 'c1'), 404, 'NOT_FOUND');
  });
});
