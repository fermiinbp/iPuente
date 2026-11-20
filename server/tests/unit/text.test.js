// Tests unitarios de normalizeText: minúsculas, sin tildes, sin espacios de más y tolerante a null.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeText } from '../../src/utils/text.js';

describe('normalizeText', () => {
  it('quita tildes y diéresis y pasa a minúsculas', () => {
    assert.equal(normalizeText('MÁLAGA'), 'malaga');
    assert.equal(normalizeText('Pingüino Ñandú'), 'pinguino nandu');
  });

  it('recorta y colapsa espacios', () => {
    assert.equal(normalizeText('  San   Sebastián \t Centro '), 'san sebastian centro');
  });

  it('tolera null, undefined y vacío', () => {
    assert.equal(normalizeText(null), '');
    assert.equal(normalizeText(undefined), '');
    assert.equal(normalizeText('   '), '');
  });

  it('convierte números a texto y es idempotente', () => {
    assert.equal(normalizeText(12), '12');
    assert.equal(normalizeText(normalizeText('Ávila')), 'avila');
  });
});
