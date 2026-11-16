// Comprueba la conexión con Firestore: escribe un documento en `_ping`, lo lee y lo borra.
// Uso (desde server/): node --env-file=.env scripts/pingDb.js
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../src/config/config.js';

async function main() {
  const ref = db().collection('_ping').doc();

  await ref.set({ ok: true, createdAt: FieldValue.serverTimestamp() });
  console.log(`Escrito _ping/${ref.id}`);

  const snap = await ref.get();
  if (!snap.exists || snap.data().ok !== true) {
    throw new Error('El documento escrito no se ha podido leer.');
  }
  console.log('Leído correctamente.');

  await ref.delete();
  console.log('Borrado. Conexión con Firestore OK.');
}

main().catch((err) => {
  console.error('Error al conectar con Firestore:', err.message);
  process.exit(1);
});
