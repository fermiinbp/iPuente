// Tests unitarios de translateConflict: errores de Firestore traducidos a 409 SLOT_TAKEN y BUSY.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { translateConflict } from '../../src/services/bookingsService.js';

describe('translateConflict', () => {
  it('traduce ALREADY_EXISTS (code 6) a 409 SLOT_TAKEN', () => {
    const err = translateConflict({ code: 6, message: '6 ALREADY_EXISTS: ya existe' });
    assert.equal(err.status, 409);
    assert.equal(err.code, 'SLOT_TAKEN');
  });

  it('traduce ABORTED (code 10, "aborted" o mensaje) a 409 BUSY', () => {
    for (const raw of [
      { code: 10, message: 'contención' },
      { code: 'aborted', message: 'x' },
      { message: '10 ABORTED: too much contention on these documents' },
    ]) {
      const err = translateConflict(raw);
      assert.equal(err.status, 409);
      assert.equal(err.code, 'BUSY');
      assert.equal(err.message, 'Hay mucha demanda en este momento; inténtalo de nuevo');
    }
  });

  it('deja pasar cualquier otro error sin cambios', () => {
    const raw = new Error('otro fallo');
    assert.equal(translateConflict(raw), raw);
  });
});
