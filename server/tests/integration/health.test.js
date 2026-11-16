// Test de integración: la API arranca y GET /api/health responde { ok: true }.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import app from '../../src/app.js';

describe('API base', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  it('GET /api/health responde 200 con { ok: true }', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('una ruta inexistente responde 404 con el formato de error común', async () => {
    const res = await fetch(`${baseUrl}/api/no-existe`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.error.message, 'string');
  });
});
