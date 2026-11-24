// Rellena `companyId` en los pagos anteriores a DAT044 que no lo tienen, a partir de la empresa de su
// reserva. Idempotente: solo toca pagos sin `companyId` cuya reserva existe y tiene empresa; los demás
// (reserva borrada o sin empresa) se cuentan y se dejan como están. Nunca inventa
// `destinationAccountId`: un pago antiguo se sigue reembolsando como siempre (sin revertir transferencia).
// Seguridad: se niega con NODE_ENV=production; imprime el proyecto destino antes de leer nada; sin
// --yes solo informa (no escribe) y para escribir exige además --project=<id> igual a FIREBASE_PROJECT_ID.
// Uso: npm run backfill-payment-company -w server -- [--yes --project=<id>]
import { pathToFileURL } from 'node:url';

import * as bookingModel from '../src/models/bookingModel.js';
import * as paymentModel from '../src/models/paymentModel.js';

const PAGE = 200;

// Recorre todos los pagos y rellena (con confirm) el companyId que falte. Devuelve los recuentos.
export async function backfillPaymentCompany({ confirm = false, project } = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El script no se puede ejecutar con NODE_ENV=production.');
  }
  const target = process.env.FIREBASE_PROJECT_ID;
  if (confirm && (!target || project !== target)) {
    throw new Error('Para escribir hace falta --project=<id> igual a FIREBASE_PROJECT_ID.');
  }
  const counts = { revisados: 0, ya_tenian: 0, actualizados: 0, sin_reserva: 0 };
  let afterId;
  for (;;) {
    const page = await paymentModel.listPage({ limit: PAGE, afterId });
    for (const payment of page) {
      counts.revisados += 1;
      if (payment.companyId !== undefined) {
        counts.ya_tenian += 1;
        continue;
      }
      const booking = payment.bookingId ? await bookingModel.findById(payment.bookingId) : null;
      if (!booking?.companyId) {
        counts.sin_reserva += 1;
        continue;
      }
      if (confirm) await paymentModel.update(payment.id, { companyId: booking.companyId });
      counts.actualizados += 1;
    }
    if (page.length < PAGE) break;
    afterId = page[page.length - 1].id;
  }
  return { dryRun: !confirm, ...counts };
}

// Solo se ejecuta al lanzarlo como script (no al importarlo desde los tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const confirm = args.includes('--yes');
  const project = args.find((a) => a.startsWith('--project='))?.slice('--project='.length);
  // El destino se imprime antes de leer nada.
  console.log(
    `Destino: proyecto de Firebase "${process.env.FIREBASE_PROJECT_ID ?? '(sin definir)'}".`,
  );
  backfillPaymentCompany({ confirm, project })
    .then((result) =>
      console.log(result.dryRun ? 'Sin --yes no se escribe nada:' : 'Hecho:', result),
    )
    .catch((err) => {
      console.error('Error al rellenar los pagos:', err.message);
      process.exit(1);
    });
}
