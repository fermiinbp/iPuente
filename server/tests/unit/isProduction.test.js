// Tests unitarios de isProductionEnv y del arranque de config.js: Vercel (VERCEL_ENV) cuenta como producción.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isProductionEnv } from '../../src/config/config.js';

const configUrl = new URL('../../src/config/config.js', import.meta.url).href;
const cwd = fileURLToPath(new URL('../..', import.meta.url));

// Importa config.js en un proceso limpio (sin variables de Firebase) con el entorno indicado.
function loadConfig(vars) {
  const base = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import('${configUrl}')`],
    {
      cwd,
      env: { ...base, ...vars },
      encoding: 'utf8',
    },
  );
}

describe('isProductionEnv', () => {
  it('es producción con NODE_ENV=production o con cualquier VERCEL_ENV', () => {
    assert.equal(isProductionEnv({ NODE_ENV: 'production' }), true);
    for (const v of ['production', 'preview', 'development']) {
      assert.equal(isProductionEnv({ VERCEL_ENV: v }), true);
      assert.equal(isProductionEnv({ NODE_ENV: 'test', VERCEL_ENV: v }), true);
    }
  });

  it('no lo es en local ni en tests', () => {
    assert.equal(isProductionEnv({}), false);
    assert.equal(isProductionEnv({ NODE_ENV: 'test' }), false);
    assert.equal(isProductionEnv({ NODE_ENV: 'development', VERCEL_ENV: '' }), false);
  });
});

describe('config.js al arrancar', () => {
  it('con VERCEL_ENV y sin variables de Firebase no arranca', () => {
    const r = loadConfig({ VERCEL_ENV: 'preview' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Faltan variables de Firebase en producción/);
  });

  it('con VERCEL_ENV y solo falta APP_URL no arranca', () => {
    const r = loadConfig({
      VERCEL_ENV: 'production',
      FIREBASE_PROJECT_ID: 'p',
      FIREBASE_CLIENT_EMAIL: 'e@p.iam',
      FIREBASE_PRIVATE_KEY: 'k',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Falta APP_URL en producción/);
  });

  it('fuera de producción arranca (solo avisa de lo que falta)', () => {
    const r = loadConfig({ NODE_ENV: 'test' });
    assert.equal(r.status, 0, r.stderr);
  });
});
