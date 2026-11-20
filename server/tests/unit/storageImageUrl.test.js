// Tests unitarios de la validación y normalización de URLs de Storage (fragmento y parámetros).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { normalizeStorageUrl, storageImageUrlError } from '../../src/validators/commonValidator.js';
import { listen, storageUrl } from '../helpers/publicData.js';

describe('storageImageUrlError y normalizeStorageUrl', () => {
  const base = storageUrl('companies/c1/a.png').replace('?alt=media&token=t', '');

  before(async () => {
    // listen() fija el bucket de pruebas; se cierra el servidor al instante.
    const { server } = await listen();
    server.close();
  });

  it('acepta alt=media con o sin token', () => {
    assert.equal(storageImageUrlError(`${base}?alt=media&token=abc-1`, 'c1'), null);
    assert.equal(storageImageUrlError(`${base}?alt=media`, 'c1'), null);
    assert.equal(storageImageUrlError(base, 'c1'), null);
  });

  it('rechaza fragmento, parámetros extra, alt distinto y repetidos', () => {
    for (const q of ['?alt=media#x', '?alt=media&a=1', '?alt=json', '?token=a&token=b', '?x=1']) {
      assert.notEqual(storageImageUrlError(base + q, 'c1'), null, q);
    }
    assert.notEqual(storageImageUrlError(`${base}#`, 'c1'), null);
  });

  it('normaliza host en mayúsculas y orden de parámetros', () => {
    const messy = `${base.replace('https://firebasestorage', 'HTTPS://FIREBASESTORAGE')}?token=t&alt=media`;
    assert.equal(normalizeStorageUrl(messy), `${base}?alt=media&token=t`);
    assert.equal(normalizeStorageUrl(base), `${base}?alt=media`);
    assert.equal(normalizeStorageUrl(5), 5);
  });
});
