// Tests unitarios de isPendingExpired y effectiveStatus: borde exacto, Date, Timestamp, ISO, datos
// inválidos y respaldo con createdAt + 15 minutos.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { effectiveStatus, isPendingExpired } from '../../src/services/availabilityService.js';

const NOW = Date.parse('2030-01-01T10:00:00Z');
const MIN = 60 * 1000;
const pending = (extra) => ({ status: 'PENDING_PAYMENT', ...extra });
const timestamp = (ms) => ({ toDate: () => new Date(ms) });

describe('isPendingExpired', () => {
  it('vence justo en expiresAt (borde exacto) y no un milisegundo antes', () => {
    assert.equal(isPendingExpired(pending({ expiresAt: new Date(NOW) }), NOW), true);
    assert.equal(isPendingExpired(pending({ expiresAt: new Date(NOW + 1) }), NOW), false);
    assert.equal(isPendingExpired(pending({ expiresAt: new Date(NOW - 1) }), NOW), true);
  });

  it('acepta Date, Timestamp de Firestore y texto ISO', () => {
    const past = NOW - MIN;
    const future = NOW + MIN;
    assert.equal(isPendingExpired(pending({ expiresAt: timestamp(past) }), NOW), true);
    assert.equal(isPendingExpired(pending({ expiresAt: timestamp(future) }), NOW), false);
    assert.equal(isPendingExpired(pending({ expiresAt: new Date(past).toISOString() }), NOW), true);
    assert.equal(
      isPendingExpired(pending({ expiresAt: new Date(future).toISOString() }), NOW),
      false,
    );
  });

  it('sin expiresAt o con uno inválido usa createdAt + 15 minutos', () => {
    for (const expiresAt of [undefined, null, 'no es fecha', {}, new Date('x'), NaN]) {
      const vieja = pending({ expiresAt, createdAt: new Date(NOW - 15 * MIN) });
      const reciente = pending({ expiresAt, createdAt: new Date(NOW - 15 * MIN + 1) });
      assert.equal(isPendingExpired(vieja, NOW), true);
      assert.equal(isPendingExpired(reciente, NOW), false);
    }
    assert.equal(isPendingExpired(pending({ createdAt: timestamp(NOW - 20 * MIN) }), NOW), true);
  });

  it('sin fechas válidas se trata como vigente y nunca lanza', () => {
    assert.equal(isPendingExpired(pending({}), NOW), false);
    assert.equal(isPendingExpired(pending({ createdAt: { sentinel: true } }), NOW), false);
    const roto = {
      toDate: () => {
        throw new Error('x');
      },
    };
    assert.equal(isPendingExpired(pending({ expiresAt: roto, createdAt: roto }), NOW), false);
    assert.equal(isPendingExpired(null, NOW), false);
  });

  it('solo las PENDING_PAYMENT vencen', () => {
    const viejo = new Date(NOW - MIN);
    for (const status of ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED']) {
      assert.equal(isPendingExpired({ status, expiresAt: viejo }, NOW), false);
    }
  });
});

describe('effectiveStatus', () => {
  it('EXPIRED para una pendiente vencida y el estado guardado en los demás casos', () => {
    assert.equal(effectiveStatus(pending({ expiresAt: new Date(NOW - 1) }), NOW), 'EXPIRED');
    assert.equal(
      effectiveStatus(pending({ expiresAt: new Date(NOW + 1) }), NOW),
      'PENDING_PAYMENT',
    );
    assert.equal(effectiveStatus({ status: 'CONFIRMED' }, NOW), 'CONFIRMED');
    assert.equal(effectiveStatus(undefined, NOW), undefined);
  });
});
