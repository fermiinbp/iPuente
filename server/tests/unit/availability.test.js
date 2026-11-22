// Tests unitarios de availabilityService: solapes, franjas activas, horas libres, toSlot y assertSlotAvailable.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertSlotAvailable,
  freeSlots,
  isActive,
  isBookable,
  overlaps,
  roomStatusAtHour,
  toSlot,
} from '../../src/services/availabilityService.js';

const reserva = (inicio, fin, status = 'CONFIRMED') => ({ tipo: 'reserva', status, inicio, fin });
const bloqueo = (inicio, fin) => ({ tipo: 'bloqueo', inicio, fin });

describe('overlaps', () => {
  it('10-12 y 12-14 no solapan (contiguas), en ambos órdenes', () => {
    const a = { inicio: 10, fin: 12 };
    const b = { inicio: 12, fin: 14 };

    assert.equal(overlaps(a, b), false);
    assert.equal(overlaps(b, a), false);
  });

  it('10-12 y 11-13 solapan', () => {
    const a = { inicio: 10, fin: 12 };
    const b = { inicio: 11, fin: 13 };

    assert.equal(overlaps(a, b), true);
    assert.equal(overlaps(b, a), true);
  });

  it('9-15 contiene a 10-12 y solapa, en ambos órdenes', () => {
    const grande = { inicio: 9, fin: 15 };
    const pequena = { inicio: 10, fin: 12 };

    assert.equal(overlaps(grande, pequena), true);
    assert.equal(overlaps(pequena, grande), true);
  });
});

describe('isActive', () => {
  it('CONFIRMED y PENDING_PAYMENT bloquean; CANCELLED y EXPIRED no', () => {
    assert.equal(isActive(reserva(10, 12, 'CONFIRMED')), true);
    assert.equal(isActive(reserva(10, 12, 'CANCELLED')), false);
    assert.equal(isActive(reserva(10, 12, 'PENDING_PAYMENT')), true);
    assert.equal(isActive(reserva(10, 12, 'EXPIRED')), false);
  });

  it('un bloqueo siempre bloquea', () => {
    assert.equal(isActive(bloqueo(10, 12)), true);
  });
});

describe('freeSlots', () => {
  it('con reserva confirmada, bloqueo y reserva cancelada devuelve el array exacto', () => {
    const items = [reserva(9, 11), bloqueo(14, 15), reserva(16, 18, 'CANCELLED')];

    const free = freeSlots(items);

    assert.deepEqual(free, [8, 11, 12, 13, 15, 16, 17, 18, 19, 20]);
  });

  it('ignora una reserva cancelada y una caducada, pero no una pendiente vigente', () => {
    const items = [
      reserva(10, 12, 'CANCELLED'),
      reserva(12, 14, 'PENDING_PAYMENT'),
      reserva(14, 15, 'EXPIRED'),
    ];

    const free = freeSlots(items, { desde: 10, hasta: 15 });

    assert.deepEqual(free, [10, 11, 14]);
  });

  it('con el día completo ocupado devuelve []', () => {
    const items = [reserva(8, 14), bloqueo(14, 21)];

    assert.deepEqual(freeSlots(items), []);
  });

  it('respeta desde y hasta personalizados', () => {
    const items = [reserva(10, 11)];

    const free = freeSlots(items, { desde: 9, hasta: 13 });

    assert.deepEqual(free, [9, 11, 12]);
  });
});

describe('toSlot', () => {
  it('convierte fechas Date en inicio y fin', () => {
    const doc = {
      status: 'CONFIRMED',
      startDate: new Date(2026, 10, 19, 10),
      endDate: new Date(2026, 10, 19, 12),
    };

    const slot = toSlot(doc, 'reserva');

    assert.deepEqual(slot, { tipo: 'reserva', status: 'CONFIRMED', inicio: 10, fin: 12 });
  });

  it('acepta objetos tipo Timestamp con toDate()', () => {
    const stamp = (date) => ({ toDate: () => date });
    const doc = {
      startDate: stamp(new Date(2026, 10, 19, 9)),
      endDate: stamp(new Date(2026, 10, 19, 11)),
    };

    const slot = toSlot(doc, 'bloqueo');

    assert.equal(slot.tipo, 'bloqueo');
    assert.equal(slot.inicio, 9);
    assert.equal(slot.fin, 11);
  });

  it('fin = 24 cuando endDate es las 00:00 del día siguiente', () => {
    const doc = {
      status: 'CONFIRMED',
      startDate: new Date(2026, 10, 19, 22),
      endDate: new Date(2026, 10, 20, 0),
    };

    const slot = toSlot(doc, 'reserva');

    assert.equal(slot.inicio, 22);
    assert.equal(slot.fin, 24);
  });
});

describe('assertSlotAvailable', () => {
  // Doble de un model: devuelve los documentos dados y registra las llamadas.
  const fakeModel = (docs = []) => {
    const calls = [];
    return {
      calls,
      listByRoom: async (roomId, options) => {
        calls.push({ roomId, options });
        return docs;
      },
    };
  };
  const at = (day, hour) => new Date(2026, 10, day, hour);
  const doc = (startHour, endHour, status) => ({
    status,
    startDate: at(19, startHour),
    endDate: at(19, endHour),
  });

  it('no lanza si la franja está libre', async () => {
    const models = { bookings: fakeModel(), blocks: fakeModel() };

    await assert.doesNotReject(() => assertSlotAvailable('r1', '2026-11-19', 10, 12, null, models));
  });

  it('lanza 409 SLOT_TAKEN si solapa con una reserva confirmada', async () => {
    const models = { bookings: fakeModel([doc(11, 13, 'CONFIRMED')]), blocks: fakeModel() };

    await assert.rejects(
      () => assertSlotAvailable('r1', '2026-11-19', 10, 12, null, models),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'SLOT_TAKEN');
        return true;
      },
    );
  });

  it('no lanza si la reserva de esa franja está cancelada', async () => {
    const models = { bookings: fakeModel([doc(10, 12, 'CANCELLED')]), blocks: fakeModel() };

    await assert.doesNotReject(() => assertSlotAvailable('r1', '2026-11-19', 10, 12, null, models));
  });

  it('lanza 409 SLOT_TAKEN si hay un bloqueo en esa franja', async () => {
    const models = { bookings: fakeModel(), blocks: fakeModel([doc(10, 12)]) };

    await assert.rejects(
      () => assertSlotAvailable('r1', '2026-11-19', 11, 13, null, models),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'SLOT_TAKEN');
        return true;
      },
    );
  });

  it('no lanza si la franja ocupada es contigua', async () => {
    const models = { bookings: fakeModel([doc(10, 12, 'CONFIRMED')]), blocks: fakeModel() };

    await assert.doesNotReject(() => assertSlotAvailable('r1', '2026-11-19', 12, 14, null, models));
  });

  it('pasa roomId, from, to y el mismo tx a ambos models', async () => {
    const tx = { id: 'tx-1' };
    const models = { bookings: fakeModel(), blocks: fakeModel() };

    await assertSlotAvailable('r1', '2026-11-19', 10, 12, tx, models);

    for (const model of [models.bookings, models.blocks]) {
      assert.equal(model.calls.length, 1);
      const { roomId, options } = model.calls[0];
      assert.equal(roomId, 'r1');
      assert.equal(options.from.getTime(), new Date(2026, 10, 19, 0).getTime());
      assert.equal(options.to.getTime(), new Date(2026, 10, 20, 0).getTime());
      assert.equal(options.tx, tx);
    }
  });
});

describe('roomStatusAtHour', () => {
  const sala = { bookable: true, status: 'ACTIVE', price: 25 };
  const items = [reserva(10, 12), bloqueo(14, 15), reserva(16, 18, 'CANCELLED')];

  it('OCCUPIED dentro de una reserva confirmada y de un bloqueo', () => {
    assert.equal(roomStatusAtHour(sala, items, 10), 'OCCUPIED');
    assert.equal(roomStatusAtHour(sala, items, 11), 'OCCUPIED');
    assert.equal(roomStatusAtHour(sala, items, 14), 'OCCUPIED');
  });

  it('FREE en los bordes: justo antes de empezar y justo al terminar', () => {
    assert.equal(roomStatusAtHour(sala, items, 9), 'FREE');
    assert.equal(roomStatusAtHour(sala, items, 12), 'FREE');
    assert.equal(roomStatusAtHour(sala, items, 15), 'FREE');
  });

  it('una reserva cancelada o caducada no ocupa y una pendiente vigente sí', () => {
    assert.equal(roomStatusAtHour(sala, items, 16), 'FREE');
    assert.equal(roomStatusAtHour(sala, [reserva(10, 12, 'EXPIRED')], 10), 'FREE');
    assert.equal(roomStatusAtHour(sala, [reserva(10, 12, 'PENDING_PAYMENT')], 10), 'OCCUPIED');
  });

  it('UNAVAILABLE si no es reservable, está inactiva, no existe o no tiene precio', () => {
    assert.equal(roomStatusAtHour({ ...sala, bookable: false }, [], 10), 'UNAVAILABLE');
    assert.equal(roomStatusAtHour({ ...sala, status: 'INACTIVE' }, [], 10), 'UNAVAILABLE');
    assert.equal(roomStatusAtHour(undefined, [], 10), 'UNAVAILABLE');
    assert.equal(roomStatusAtHour({ ...sala, price: null }, [], 10), 'UNAVAILABLE');
    assert.equal(roomStatusAtHour({ ...sala, price: 0 }, [], 10), 'UNAVAILABLE');
  });
});

describe('isBookable', () => {
  it('exige reservable, activa y precio numérico mayor que 0', () => {
    const base = { bookable: true, status: 'ACTIVE', price: 10 };
    assert.equal(isBookable(base), true);
    assert.equal(isBookable({ ...base, price: undefined }), false);
    assert.equal(isBookable({ ...base, price: '10' }), false);
    assert.equal(isBookable({ ...base, price: 0 }), false);
  });
});
