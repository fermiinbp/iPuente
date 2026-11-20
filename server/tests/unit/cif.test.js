// Tests unitarios de utils/cif.js: normalizar y validar el dígito de control de un CIF.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidCif, normalizeCif } from '../../src/utils/cif.js';

describe('normalizeCif', () => {
  it('quita espacios y guiones y pasa a mayúsculas', () => {
    assert.equal(normalizeCif(' b-1234 5674 '), 'B12345674');
  });

  it('devuelve cadena vacía si no es texto', () => {
    assert.equal(normalizeCif(undefined), '');
    assert.equal(normalizeCif(12345678), '');
  });
});

describe('isValidCif', () => {
  it('acepta un CIF válido, también con minúsculas, espacios y guiones', () => {
    assert.equal(isValidCif('B12345674'), true);
    assert.equal(isValidCif('b-12345674'), true);
    assert.equal(isValidCif(' B 12345674 '), true);
  });

  it('acepta un CIF con letra de control (tipo P)', () => {
    assert.equal(isValidCif('P1234567D'), true);
  });

  it('rechaza un dígito de control incorrecto', () => {
    assert.equal(isValidCif('B12345675'), false);
  });

  it('rechaza un tipo que exige letra con dígito y al revés', () => {
    assert.equal(isValidCif('P12345674'), false);
    assert.equal(isValidCif('B1234567D'), false);
  });

  it('rechaza formatos incorrectos', () => {
    for (const value of ['', 'B1234567', 'Z12345674', '123456789', 'B123456745', null, 5]) {
      assert.equal(isValidCif(value), false, String(value));
    }
  });
});
