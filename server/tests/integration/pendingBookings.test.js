// Test de integración: reservas PENDING_PAYMENT con caducidad perezosa (expiresAt). Una pendiente
// vigente ocupa, una vencida no (disponibilidad, plano, buscador, reservas futuras, borrado y
// resumen); reservar o bloquear sobre una vencida la expira; los listados la muestran EXPIRED.
// Se llama a los services (y a la API pública) con Firestore y tokens sustituidos por dobles.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { setDbForTests } from '../../src/config/config.js';
import { setStripeForTests } from '../../src/config/stripe.js';
import { setTokenVerifier } from '../../src/middlewares/auth.js';
import * as blockModel from '../../src/models/blockModel.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as occupancyModel from '../../src/models/occupancyModel.js';
import * as roomModel from '../../src/models/roomModel.js';
import * as userModel from '../../src/models/userModel.js';
import * as adminService from '../../src/services/adminService.js';
import * as bookingsService from '../../src/services/bookingsService.js';
import * as companyBookingsService from '../../src/services/companyBookingsService.js';
import { getSummary } from '../../src/services/companySummaryService.js';
import { deleteRoom } from '../../src/services/deletionService.js';
import { countFutureBookings } from '../../src/services/futureBookingsService.js';
import { addDays, todayString } from '../../src/utils/dates.js';
import { createFakeFirestore } from '../helpers/fakeFirestore.js';
import { createStripeDouble } from '../helpers/stripeDouble.js';
import { FECHA, getJson, listen, seedPublicData, seedSearchData } from '../helpers/publicData.js';

const FUT = '2030-03-12';
const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const minutes = (n) => new Date(Date.now() + n * 60 * 1000);
const at = (fecha, hour) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

describe('Reservas pendientes de pago y caducidad', () => {
  let server;
  let baseUrl;

  // Reserva PENDING_PAYMENT con sus fichas de occupancy. expiresAt undefined = dato antiguo.
  async function seedPending(id, roomId, inicio, fin, expiresAt, fecha = FUT) {
    await bookingModel.create(
      {
        code: `IP-${id}`,
        userId: 'u1',
        companyId: 'c1',
        roomId,
        startDate: at(fecha, inicio),
        endDate: at(fecha, fin),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 25 * (fin - inicio),
        status: 'PENDING_PAYMENT',
        ...(expiresAt && { expiresAt }),
      },
      { id },
    );
    for (let h = inicio; h < fin; h++) {
      await occupancyModel.create(
        { companyId: 'c1', roomId, date: fecha, hour: h, bookingId: id },
        { id: occupancyModel.slotId(roomId, fecha, h) },
      );
    }
  }

  const slot = (roomId, h, fecha = FUT) =>
    occupancyModel.findById(occupancyModel.slotId(roomId, fecha, h));
  const reservar = (franja, opts) =>
    bookingsService.createBooking('u2', { roomId: 'r-free', fecha: FUT, ...franja }, opts);

  before(async () => {
    ({ server, baseUrl } = await listen());
  });

  beforeEach(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    setStripeForTests({ client: createStripeDouble(), webhookSecret: 'whsec_test' });
    setDbForTests(createFakeFirestore());
    setTokenVerifier(async (token) => ({ uid: token }));
    await seedPublicData();
    await userModel.create({ name: 'Ana', email: 'ana@x.es', role: 'CLIENT' }, { id: 'u1' });
  });

  after(async () => {
    setStripeForTests(null);
    setTokenVerifier(null);
    setDbForTests(null);
    await new Promise((resolve) => server.close(resolve));
  });

  describe('crear', () => {
    it('por defecto la reserva nace CONFIRMED y sin expiresAt', async () => {
      const res = await reservar({ inicio: 10, fin: 12 });
      assert.equal(res.estado, 'CONFIRMED');
      assert.equal(res.expiraEn, undefined);
      const doc = await bookingModel.findById(res.id);
      assert.equal(doc.status, 'CONFIRMED');
      assert.equal('expiresAt' in doc, false);
    });

    it('con pendingPayment nace PENDING_PAYMENT con expiresAt a +15 min y retiene las horas', async () => {
      const antes = Date.now();
      const res = await reservar({ inicio: 10, fin: 12 }, { pendingPayment: true });
      assert.equal(res.estado, 'PENDING_PAYMENT');
      const doc = await bookingModel.findById(res.id);
      assert.equal(doc.status, 'PENDING_PAYMENT');
      const ms = doc.expiresAt.getTime() - antes;
      assert.ok(ms >= 15 * 60 * 1000 && ms < 15 * 60 * 1000 + 5000);
      assert.equal(res.expiraEn, doc.expiresAt.toISOString());
      assert.equal((await slot('r-free', 10)).bookingId, res.id);
      assert.equal((await slot('r-free', 11)).bookingId, res.id);
    });

    it('una reserva de 0 € (sala gratis) se confirma siempre, aunque se pida pendiente', async () => {
      await roomModel.update('r-free', { isFree: true, price: null });
      const res = await reservar({ inicio: 10, fin: 12 }, { pendingPayment: true });
      assert.equal(res.estado, 'CONFIRMED');
      assert.equal(res.importe, 0);
      const doc = await bookingModel.findById(res.id);
      assert.equal(doc.status, 'CONFIRMED');
      assert.equal('expiresAt' in doc, false);
    });
  });

  describe('qué ocupa', () => {
    it('la pendiente vigente ocupa en horas libres y en el plano', async () => {
      await seedPending('p1', 'r-free', 10, 12, minutes(10), FECHA);
      const { body } = await getJson(baseUrl, `/api/rooms/r-free/availability?fecha=${FECHA}`);
      assert.deepEqual(
        body.horasLibres,
        HORAS.filter((h) => h !== 10 && h !== 11),
      );
      const plano = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
      assert.equal(plano.body.salas.find((s) => s.id === 'r-free').estado, 'OCCUPIED');
    });

    it('la pendiente vencida no ocupa en horas libres ni en el plano', async () => {
      await seedPending('p1', 'r-free', 10, 12, minutes(-1), FECHA);
      const { body } = await getJson(baseUrl, `/api/rooms/r-free/availability?fecha=${FECHA}`);
      assert.deepEqual(body.horasLibres, HORAS);
      const plano = await getJson(baseUrl, `/api/floors/f-0?fecha=${FECHA}`);
      assert.equal(plano.body.salas.find((s) => s.id === 'r-free').estado, 'FREE');
    });

    it('una pendiente sin expiresAt (dato antiguo) se trata como vigente y ocupa', async () => {
      await seedPending('p1', 'r-free', 10, 12, undefined, FECHA);
      const { body } = await getJson(baseUrl, `/api/rooms/r-free/availability?fecha=${FECHA}`);
      assert.equal(body.horasLibres.includes(10), false);
    });

    it('en el buscador, una pendiente vigente quita la sala y una vencida no', async () => {
      await seedSearchData();
      const ids = async () =>
        (
          await getJson(
            baseUrl,
            '/api/buildings?ciudad=malaga&personas=3&precioMax=20&fecha=2026-06-16',
          )
        ).body.edificios.map((b) => b.id);
      await seedPending('pm', 'r-mal-full', 8, 20, minutes(10), '2026-06-16');
      assert.deepEqual(await ids(), []);
      await bookingModel.update('pm', { expiresAt: minutes(-1) });
      assert.deepEqual(await ids(), ['b-mal']);
    });

    it('reservas futuras, borrado y resumen: la vigente cuenta y la vencida no', async () => {
      await seedPending('pv', 'r-free', 10, 12, minutes(10));
      assert.equal(await countFutureBookings(['r-free']), 1);
      const resumen = await getSummary('c1');
      assert.deepEqual(
        resumen.proximasReservas.map((r) => [r.id, r.estado]),
        [['pv', 'PENDING_PAYMENT']],
      );
      await assert.rejects(deleteRoom('c1', 'r-free'), (err) => err.code === 'HAS_FUTURE_BOOKINGS');

      await bookingModel.update('pv', { expiresAt: minutes(-1) });
      assert.equal(await countFutureBookings(['r-free']), 0);
      assert.deepEqual((await getSummary('c1')).proximasReservas, []);
      const futuras = await companyBookingsService.listFutureBookings('c1', 'r-free');
      assert.deepEqual(futuras, []);
      const borrado = await deleteRoom('c1', 'r-free');
      assert.equal(borrado.eliminado, true);
    });
  });

  describe('reservar o bloquear sobre una pendiente', () => {
    it('sobre una vencida: la expira, la sustituye y libera TODAS sus horas', async () => {
      await seedPending('pold', 'r-free', 10, 14, minutes(-5));
      const res = await reservar({ inicio: 12, fin: 14 });
      assert.equal(res.estado, 'CONFIRMED');
      assert.equal((await bookingModel.findById('pold')).status, 'EXPIRED');
      // Las de la vieja fuera de la franja nueva quedan libres; las de la franja son de la nueva.
      assert.equal(await slot('r-free', 10), null);
      assert.equal(await slot('r-free', 11), null);
      assert.equal((await slot('r-free', 12)).bookingId, res.id);
      assert.equal((await slot('r-free', 13)).bookingId, res.id);
    });

    it('no toca fichas que ya son de otra reserva', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-5));
      // La ficha de las 11 pasó a ser de otra reserva (dato corregido a mano): no se borra.
      await occupancyModel.update(occupancyModel.slotId('r-free', FUT, 11), { bookingId: 'otra' });
      await reservar({ inicio: 10, fin: 11 });
      assert.equal((await slot('r-free', 11)).bookingId, 'otra');
      assert.equal((await bookingModel.findById('pold')).status, 'EXPIRED');
    });

    it('sobre una vigente responde 409 SLOT_TAKEN sin tocar nada', async () => {
      await seedPending('pv', 'r-free', 10, 12, minutes(10));
      await assert.rejects(reservar({ inicio: 11, fin: 13 }), (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'SLOT_TAKEN');
        return true;
      });
      assert.equal((await bookingModel.findById('pv')).status, 'PENDING_PAYMENT');
      assert.equal(await slot('r-free', 12), null);
    });

    it('sobre una confirmada o un bloqueo responde 409 SLOT_TAKEN', async () => {
      const ok = await reservar({ inicio: 10, fin: 12 });
      await assert.rejects(reservar({ inicio: 11, fin: 13 }), (e) => e.code === 'SLOT_TAKEN');
      await bookingsService.cancelBooking('u2', ok.id);
      await companyBookingsService.createBlock('c1', {
        roomId: 'r-free',
        fecha: FUT,
        inicio: 10,
        fin: 12,
        motivo: 'x',
      });
      await assert.rejects(reservar({ inicio: 11, fin: 13 }), (e) => e.code === 'SLOT_TAKEN');
    });

    it('bloquear sobre una vencida la expira y libera sus horas; sobre una vigente, 409', async () => {
      await seedPending('pold', 'r-free', 10, 14, minutes(-5));
      const block = await companyBookingsService.createBlock('c1', {
        roomId: 'r-free',
        fecha: FUT,
        inicio: 12,
        fin: 13,
        motivo: 'Obras',
      });
      assert.equal((await bookingModel.findById('pold')).status, 'EXPIRED');
      assert.equal(await slot('r-free', 10), null);
      assert.equal(await slot('r-free', 13), null);
      assert.equal((await slot('r-free', 12)).blockId, block.id);

      await seedPending('pv', 'r-free', 15, 17, minutes(10));
      await assert.rejects(
        companyBookingsService.createBlock('c1', {
          roomId: 'r-free',
          fecha: FUT,
          inicio: 16,
          fin: 18,
          motivo: 'x',
        }),
        (err) => err.status === 409 && err.code === 'SLOT_TAKEN',
      );
    });
  });

  describe('extender expiresAt', () => {
    it('alarga una pendiente vigente sin tocar su occupancy', async () => {
      await seedPending('pv', 'r-free', 10, 12, minutes(10));
      await bookingModel.update('pv', { createdAt: new Date() });
      const nueva = minutes(40);
      const res = await bookingsService.extendPendingExpiry('pv', nueva);
      assert.equal(res.getTime(), nueva.getTime());
      assert.equal((await bookingModel.findById('pv')).expiresAt.getTime(), nueva.getTime());
      assert.equal((await slot('r-free', 10)).bookingId, 'pv');
    });

    it('no la acorta', async () => {
      const larga = minutes(60);
      await seedPending('pv', 'r-free', 10, 12, larga);
      await bookingModel.update('pv', { createdAt: new Date() });
      await bookingsService.extendPendingExpiry('pv', minutes(30));
      assert.equal((await bookingModel.findById('pv')).expiresAt.getTime(), larga.getTime());
    });

    it('409 si está vencida o ya no es pendiente y 404 si no existe', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-1));
      await assert.rejects(
        bookingsService.extendPendingExpiry('pold', minutes(40)),
        (e) => e.status === 409 && e.code === 'BOOKING_EXPIRED',
      );
      const ok = await reservar({ inicio: 14, fin: 15 });
      await assert.rejects(
        bookingsService.extendPendingExpiry(ok.id, minutes(40)),
        (e) => e.status === 409 && e.code === 'BOOKING_NOT_PENDING',
      );
      await assert.rejects(
        bookingsService.extendPendingExpiry('nada', minutes(40)),
        (e) => e.status === 404,
      );
    });
  });

  describe('cancelar', () => {
    it('una pendiente vigente se cancela y libera sus horas', async () => {
      await seedPending('pv', 'r-free', 10, 12, minutes(10));
      await bookingModel.update('pv', { userId: 'u2' });
      const res = await bookingsService.cancelBooking('u2', 'pv');
      assert.equal(res.estado, 'CANCELLED');
      assert.equal(await slot('r-free', 10), null);
      assert.equal(await slot('r-free', 11), null);
    });

    it('una pendiente vencida responde 400 BOOKING_NOT_CANCELLABLE y no cambia nada', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-1));
      await bookingModel.update('pold', { userId: 'u2' });
      await assert.rejects(
        bookingsService.cancelBooking('u2', 'pold'),
        (e) =>
          e.status === 400 && e.code === 'BOOKING_NOT_CANCELLABLE' && /caducado/.test(e.message),
      );
      assert.equal((await bookingModel.findById('pold')).status, 'PENDING_PAYMENT');
    });

    it('no borra una ficha de occupancy que es de otra reserva', async () => {
      const res = await reservar({ inicio: 10, fin: 12 });
      await occupancyModel.update(occupancyModel.slotId('r-free', FUT, 11), { bookingId: 'otra' });
      await bookingsService.cancelBooking('u2', res.id);
      assert.equal(await slot('r-free', 10), null);
      assert.equal((await slot('r-free', 11)).bookingId, 'otra');
    });
  });

  describe('listados con EXPIRED calculado', () => {
    it('cliente, empresa y admin ven EXPIRED sin que se escriba en Firestore', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-1));
      await seedPending('pv', 'r-free', 14, 16, minutes(10));

      const mias = await bookingsService.listMyBookings('u1');
      const estados = Object.fromEntries(
        [...mias.proximas, ...mias.pasadas].map((b) => [b.id, b.estado]),
      );
      assert.deepEqual(estados, { pold: 'EXPIRED', pv: 'PENDING_PAYMENT' });
      assert.ok(mias.proximas.find((b) => b.id === 'pv').expiraEn);

      const empresa = await companyBookingsService.listBookings('c1', {
        desde: '2030-01-01',
        hasta: '2030-12-31',
      });
      assert.deepEqual(Object.fromEntries(empresa.map((b) => [b.id, b.estado])), estados);

      const admin = await adminService.listBookings({ desde: '2030-01-01', hasta: '2030-12-31' });
      assert.deepEqual(Object.fromEntries(admin.reservas.map((b) => [b.id, b.estado])), estados);
      const soloPend = await adminService.listBookings({
        desde: '2030-01-01',
        hasta: '2030-12-31',
        estado: 'PENDING_PAYMENT',
      });
      assert.deepEqual(
        soloPend.reservas.map((b) => b.id),
        ['pv'],
      );
      assert.equal((await adminService.getBooking('pold')).estado, 'EXPIRED');

      // Nada se ha escrito: Firestore sigue diciendo PENDING_PAYMENT.
      assert.equal((await bookingModel.findById('pold')).status, 'PENDING_PAYMENT');
    });
  });

  // Reserva con el estado dado y sus fichas de occupancy.
  async function seedWithSlots(id, status, inicio, fin, extra = {}, fecha = FUT) {
    await bookingModel.create(
      {
        code: `IP-${id}`,
        userId: 'u1',
        companyId: 'c1',
        roomId: 'r-free',
        startDate: at(fecha, inicio),
        endDate: at(fecha, fin),
        price: 25,
        pricePeriod: 'HOUR',
        totalAmount: 25 * (fin - inicio),
        status,
        ...extra,
      },
      { id },
    );
    for (let h = inicio; h < fin; h++) {
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: fecha, hour: h, bookingId: id },
        { id: occupancyModel.slotId('r-free', fecha, h) },
      );
    }
  }
  const bloquear = (franja) =>
    companyBookingsService.createBlock('c1', {
      roomId: 'r-free',
      fecha: FUT,
      motivo: 'x',
      ...franja,
    });

  describe('concurrencia y varias vencidas', () => {
    it('dos reservas a la vez sobre la misma vencida: una gana y la otra recibe 409', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-5));
      const results = await Promise.allSettled([
        reservar({ inicio: 10, fin: 12 }),
        reservar({ inicio: 11, fin: 12 }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const ko = results.filter((r) => r.status === 'rejected');
      assert.equal(ok.length, 1);
      assert.equal(ko.length, 1);
      assert.equal(ko[0].reason.code, 'SLOT_TAKEN');
      assert.equal((await bookingModel.findById('pold')).status, 'EXPIRED');
      assert.equal((await slot('r-free', 11)).bookingId, ok[0].value.id);
    });

    it('reservar y bloquear a la vez sobre la misma vencida: solo uno se queda la franja', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-5));
      const results = await Promise.allSettled([
        reservar({ inicio: 10, fin: 12 }),
        bloquear({ inicio: 11, fin: 13 }),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const ko = results.find((r) => r.status === 'rejected');
      assert.equal(ko.reason.code, 'SLOT_TAKEN');
      assert.notEqual(await slot('r-free', 11), null);
    });

    it('dos vencidas distintas en la misma franja: expira las dos y libera todas sus horas', async () => {
      await seedPending('p1', 'r-free', 10, 12, minutes(-5));
      await seedPending('p2', 'r-free', 12, 14, minutes(-1));
      const res = await reservar({ inicio: 11, fin: 13 });
      assert.equal((await bookingModel.findById('p1')).status, 'EXPIRED');
      assert.equal((await bookingModel.findById('p2')).status, 'EXPIRED');
      assert.equal(await slot('r-free', 10), null);
      assert.equal(await slot('r-free', 13), null);
      assert.equal((await slot('r-free', 11)).bookingId, res.id);
      assert.equal((await slot('r-free', 12)).bookingId, res.id);
    });
  });

  describe('fichas de reservas que ya no ocupan', () => {
    for (const status of ['CANCELLED', 'EXPIRED', 'COMPLETED']) {
      it(`una ficha de una reserva ${status} se sustituye sin cambiar su estado`, async () => {
        await seedWithSlots('old', status, 10, 13);
        const res = await reservar({ inicio: 11, fin: 12 });
        assert.equal((await bookingModel.findById('old')).status, status);
        assert.equal((await slot('r-free', 11)).bookingId, res.id);
        // Sus otras fichas, ya huérfanas, quedan libres.
        assert.equal(await slot('r-free', 10), null);
        assert.equal(await slot('r-free', 12), null);
      });
    }

    it('una ficha de una reserva que no existe sigue dando 409 SLOT_TAKEN', async () => {
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour: 10, bookingId: 'fantasma' },
        { id: occupancyModel.slotId('r-free', FUT, 10) },
      );
      await assert.rejects(reservar({ inicio: 10, fin: 11 }), (e) => e.code === 'SLOT_TAKEN');
      await assert.rejects(bloquear({ inicio: 10, fin: 11 }), (e) => e.code === 'SLOT_TAKEN');
    });

    it('una ficha de bloqueo o de una CONFIRMED sigue dando 409 SLOT_TAKEN', async () => {
      await seedWithSlots('conf', 'CONFIRMED', 10, 11);
      await assert.rejects(reservar({ inicio: 10, fin: 11 }), (e) => e.code === 'SLOT_TAKEN');
      await occupancyModel.create(
        { companyId: 'c1', roomId: 'r-free', date: FUT, hour: 14, blockId: 'bl' },
        { id: occupancyModel.slotId('r-free', FUT, 14) },
      );
      await assert.rejects(reservar({ inicio: 14, fin: 15 }), (e) => e.code === 'SLOT_TAKEN');
    });
  });

  describe('próximas reservas del resumen', () => {
    it('no se queda vacío cuando hay más vencidas que el lote inicial', async () => {
      for (let h = 8; h < 20; h++) await seedPending(`e${h}`, 'r-free', h, h + 1, minutes(-5));
      await seedPending('v1', 'r-free', 8, 10, minutes(10), '2030-03-13');
      await seedPending('v2', 'r-free', 10, 12, minutes(10), '2030-03-13');
      const { proximasReservas } = await getSummary('c1');
      assert.deepEqual(
        proximasReservas.map((r) => r.id),
        ['v1', 'v2'],
      );
    });
  });

  describe('resumen y listado de admin con EXPIRED efectivo', () => {
    const HOY = todayString();

    it('porEstado mueve las vencidas de PENDING_PAYMENT a EXPIRED', async () => {
      await seedPending('e1', 'r-free', 10, 11, minutes(-5), HOY);
      await seedPending('e2', 'r-free', 11, 12, minutes(-5), HOY);
      await seedPending('v1', 'r-free', 12, 13, minutes(10), HOY);
      await seedWithSlots('ex', 'EXPIRED', 14, 15, {}, HOY);
      const { reservasMes } = await adminService.getSummary();
      assert.equal(reservasMes.porEstado.PENDING_PAYMENT, 1);
      assert.equal(reservasMes.porEstado.EXPIRED, 3);
      assert.equal(reservasMes.total, 4);
      assert.equal('truncado' in reservasMes, false);
    });

    it('indica truncado si se alcanza el tope de lectura', async () => {
      await seedPending('e1', 'r-free', 10, 11, minutes(-5), HOY);
      await seedPending('v1', 'r-free', 12, 13, minutes(10), HOY);
      const { reservasMes } = await adminService.getSummary({ readLimit: 2 });
      assert.equal(reservasMes.truncado, true);
    });

    it('estado=EXPIRED junta las guardadas y las vencidas, recientes primero, con tope', async () => {
      const manana = addDays(HOY, 1);
      await seedWithSlots('ex', 'EXPIRED', 9, 10, {}, manana);
      await seedPending('pe', 'r-free', 10, 11, minutes(-5), HOY);
      await seedPending('pv', 'r-free', 12, 13, minutes(10), HOY);
      const all = await adminService.listBookings({ estado: 'EXPIRED' });
      assert.deepEqual(
        all.reservas.map((b) => [b.id, b.estado]),
        [
          ['ex', 'EXPIRED'],
          ['pe', 'EXPIRED'],
        ],
      );
      assert.equal(all.total, 2);
      assert.equal(all.truncado, false);
      const tope = await adminService.listBookings({ estado: 'EXPIRED', readLimit: 1 });
      assert.equal(tope.truncado, true);
      assert.ok(tope.desdeEfectivo);
      assert.ok(tope.reservas.length <= 1);
    });
  });

  describe('extendPendingExpiry con reloj inyectado', () => {
    it('evalúa el reloj dentro de la transacción', async () => {
      await seedPending('pv', 'r-free', 10, 12, minutes(10));
      await bookingModel.update('pv', { createdAt: new Date() });
      await assert.rejects(
        bookingsService.extendPendingExpiry('pv', minutes(60), {
          clock: () => Date.now() + 20 * 60000,
        }),
        (e) => e.code === 'BOOKING_EXPIRED',
      );
      await bookingsService.extendPendingExpiry('pv', minutes(60), { clock: () => Date.now() });
      // Se recorta al tope absoluto: createdAt + 50 min.
      assert.ok((await bookingModel.findById('pv')).expiresAt.getTime() > minutes(49).getTime());
    });
  });

  describe('Mis reservas con pendientes vencidas', () => {
    it('una pendiente vencida futura va a pasadas, no a próximas', async () => {
      await seedPending('pold', 'r-free', 10, 12, minutes(-1));
      await seedPending('pv', 'r-free', 14, 16, minutes(10));
      const { proximas, pasadas } = await bookingsService.listMyBookings('u1');
      assert.deepEqual(
        proximas.map((b) => b.id),
        ['pv'],
      );
      assert.deepEqual(
        pasadas.map((b) => b.id),
        ['pold'],
      );
    });
  });

  describe('bloqueos ajenos', () => {
    it('quitar un bloqueo no borra la ficha de otra reserva', async () => {
      const block = await companyBookingsService.createBlock('c1', {
        roomId: 'r-free',
        fecha: FUT,
        inicio: 10,
        fin: 12,
        motivo: 'x',
      });
      const id11 = occupancyModel.slotId('r-free', FUT, 11);
      await occupancyModel.remove(id11);
      await occupancyModel.create({ bookingId: 'otra' }, { id: id11 });
      await companyBookingsService.removeBlock('c1', block.id);
      assert.equal(await slot('r-free', 10), null);
      assert.equal((await slot('r-free', 11)).bookingId, 'otra');
      assert.equal(await blockModel.findById(block.id), null);
    });
  });
});
