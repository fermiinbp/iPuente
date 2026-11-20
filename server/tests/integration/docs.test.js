// Test de integración: la especificación OpenAPI se genera y documenta todas las rutas.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import app from '../../src/app.js';
import { swaggerSpec } from '../../src/config/swagger.js';

describe('Documentación de la API (Swagger)', () => {
  it('la especificación es OpenAPI 3 con título, servidor /api y bearerAuth', () => {
    assert.match(swaggerSpec.openapi, /^3\./);
    assert.equal(swaggerSpec.info.title, 'iPuente API');
    assert.deepEqual(swaggerSpec.servers, [{ url: '/api' }]);
    assert.equal(swaggerSpec.components.securitySchemes.bearerAuth.scheme, 'bearer');
    for (const name of ['BadRequest', 'Unauthorized', 'Forbidden', 'NotFound']) {
      assert.ok(swaggerSpec.components.responses[name], `falta la respuesta ${name}`);
    }
  });

  it('/health aparece documentada en paths', () => {
    assert.ok(swaggerSpec.paths['/health']?.get, 'GET /health no está en la especificación');
  });

  it('/users/me aparece documentada, protegida con bearerAuth', () => {
    const op = swaggerSpec.paths['/users/me']?.get;
    assert.ok(op, 'GET /users/me no está en la especificación');
    assert.deepEqual(op.security, [{ bearerAuth: [] }]);
    assert.ok(op.responses['401'], 'falta la respuesta 401');
  });

  it('los registros y /companies/me aparecen documentados', () => {
    assert.ok(swaggerSpec.paths['/auth/register/client']?.post, 'falta register/client');
    assert.ok(swaggerSpec.paths['/auth/register/company']?.post, 'falta register/company');
    const me = swaggerSpec.paths['/companies/me']?.get;
    assert.ok(me, 'GET /companies/me no está en la especificación');
    assert.deepEqual(me.security, [{ bearerAuth: [] }]);
  });

  describe('GET /api/docs', () => {
    let server;
    let baseUrl;

    before(async () => {
      server = app.listen(0);
      await new Promise((resolve) => server.once('listening', resolve));
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    it('sirve la página de Swagger UI', async () => {
      const res = await fetch(`${baseUrl}/api/docs/`);
      assert.equal(res.status, 200);
      assert.match(await res.text(), /swagger-ui/i);
    });
  });
});
