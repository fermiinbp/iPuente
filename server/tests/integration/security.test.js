// Test de integración: rate limit (429 RATE_LIMITED con límites bajos) y CORS restringido a APP_URL.
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';

import { config, db, setDbForTests } from '../../src/config/config.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import { aiDetectLimiter, setRateLimitForTests } from '../../src/middlewares/rateLimit.js';
import { setAuthClientForTests } from '../../src/services/authService.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { listen } from '../helpers/publicData.js';

describe('Seguridad de la API: rate limit y CORS', () => {
  let server;
  let baseUrl;
  const originalAppUrl = config.appUrl;

  before(async () => {
    ({ server, baseUrl } = await listen());
    setDbForTests(createFakeFirestore());
  });

  afterEach(() => {
    setRateLimitForTests(null);
    setDbForTests(createFakeFirestore());
    config.appUrl = originalAppUrl;
  });

  after(async () => {
    setDbForTests(null);
    setAuthClientForTests(null);
    setTokenVerifier(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('rate limit', () => {
    it('el límite general responde 429 RATE_LIMITED con el formato común y cabeceras estándar', async () => {
      setRateLimitForTests({ general: { limit: 2, windowMs: 60_000 } });
      const r1 = await fetch(`${baseUrl}/api/health`);
      const r2 = await fetch(`${baseUrl}/api/health`);
      const r3 = await fetch(`${baseUrl}/api/health`);
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);
      assert.equal(r3.status, 429);
      const body = await r3.json();
      assert.equal(body.error.code, 'RATE_LIMITED');
      assert.ok(body.error.message);
      assert.ok(r1.headers.get('ratelimit') || r1.headers.get('ratelimit-policy'));
      assert.equal(r1.headers.get('x-ratelimit-limit'), null);
    });

    it('sin activarlo en tests no limita', async () => {
      for (let i = 0; i < 5; i++) {
        assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
      }
    });

    it('el registro tiene su propio límite estricto', async () => {
      setRateLimitForTests({ register: { limit: 1, windowMs: 60_000 } });
      const post = () =>
        fetch(`${baseUrl}/api/auth/register/client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      assert.equal((await post()).status, 400);
      const limited = await post();
      assert.equal(limited.status, 429);
      assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
      // El resto de la API no se ve afectada por el límite del registro.
      assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    });

    it('aiDetectLimiter cuenta por uid si hay sesión y por IP si no', async () => {
      setRateLimitForTests({ ai: { limit: 1, windowMs: 60_000 } });
      const run = (req) =>
        new Promise((resolve) => {
          aiDetectLimiter(
            { ip: '1.2.3.4', app: { get: () => false }, headers: {}, ...req },
            { setHeader() {}, getHeader() {}, set() {}, append() {}, headersSent: false },
            (err) => resolve(err ? err.code : 'pasa'),
          );
        });
      assert.equal(await run({ user: { uid: 'a' } }), 'pasa');
      assert.equal(await run({ user: { uid: 'a' } }), 'RATE_LIMITED');
      assert.equal(await run({ user: { uid: 'b' } }), 'pasa');
      assert.equal(await run({}), 'pasa');
      assert.equal(await run({}), 'RATE_LIMITED');
    });
  });

  describe('IP real y store de Firestore', () => {
    const health = (headers) => fetch(`${baseUrl}/api/health`, { headers });

    it('con x-vercel-forwarded-for, distintas X-Forwarded-For cuentan juntas', async () => {
      setRateLimitForTests({ general: { limit: 2, windowMs: 60_000 } });
      const nf = { 'x-vercel-forwarded-for': '9.9.9.9' };
      assert.equal((await health({ ...nf, 'x-forwarded-for': '1.1.1.1' })).status, 200);
      assert.equal((await health({ ...nf, 'x-forwarded-for': '2.2.2.2' })).status, 200);
      assert.equal((await health({ ...nf, 'x-forwarded-for': '3.3.3.3' })).status, 429);
      // Otra IP de Vercel cuenta aparte.
      assert.equal((await health({ 'x-vercel-forwarded-for': '8.8.8.8' })).status, 200);
    });

    it('el contador del registro se guarda en rateLimits con expiresAt', async () => {
      setRateLimitForTests({ register: { limit: 5, windowMs: 60_000 } });
      await fetch(`${baseUrl}/api/auth/register/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const docs = await db().collection('rateLimits').get();
      assert.equal(docs.size, 1);
      const data = docs.docs[0].data();
      assert.equal(data.count, 1);
      assert.ok(data.expiresAt.getTime() > Date.now());
    });

    const runAi = () =>
      new Promise((resolve) => {
        aiDetectLimiter(
          { ip: '1.2.3.4', app: { get: () => false }, headers: {}, user: { uid: 'a' } },
          { setHeader() {}, getHeader() {}, set() {}, append() {}, headersSent: false },
          (err) => resolve(err ? err.code : 'pasa'),
        );
      });

    it('si Firestore falla, la IA falla cerrado (RATE_LIMIT_UNAVAILABLE)', async () => {
      setRateLimitForTests({ ai: { limit: 5, windowMs: 60_000 } });
      setDbForTests({
        runTransaction: async () => {
          throw new Error('Firestore caído');
        },
        collection: () => ({ doc: () => ({}) }),
      });
      const log = console.error;
      console.error = () => {};
      try {
        assert.equal(await runAi(), 'RATE_LIMIT_UNAVAILABLE');
      } finally {
        console.error = log;
      }
    });
  });

  describe('CORS', () => {
    const origin = (value) =>
      fetch(`${baseUrl}/api/health`, value ? { headers: { Origin: value } } : undefined);

    it('permite el origen de APP_URL', async () => {
      config.appUrl = 'https://ipuente.example.com';
      const res = await origin('https://ipuente.example.com');
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('access-control-allow-origin'), 'https://ipuente.example.com');
    });

    it('un origen distinto no recibe cabeceras CORS', async () => {
      config.appUrl = 'https://ipuente.example.com';
      const res = await origin('https://malo.example.com');
      assert.equal(res.headers.get('access-control-allow-origin'), null);
    });

    it('sin cabecera Origin (curl, servidor a servidor) se permite', async () => {
      config.appUrl = 'https://ipuente.example.com';
      assert.equal((await origin()).status, 200);
    });

    it('sin APP_URL (producción) ningún origen del navegador está permitido', async () => {
      config.appUrl = undefined;
      const res = await origin('http://localhost:5173');
      assert.equal(res.headers.get('access-control-allow-origin'), null);
    });
  });
});
