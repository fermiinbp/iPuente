// Sincroniza el claim companyApproved: true al dueño de cada empresa APPROVED y false al resto.
// También rellena companyTaxIds/{cif}. Idempotente: solo escribe si el claim cambia. Uso: npm run sync-company-claims -w server
import { adminAuth } from '../src/config/config.js';
import * as companyModel from '../src/models/companyModel.js';
import * as companyTaxIdModel from '../src/models/companyTaxIdModel.js';

// Pone el claim al dueño si hace falta. Devuelve 'actualizado', 'igual' o 'sin dueño'.
async function syncOwner(ownerUid, approved) {
  if (!ownerUid) return 'sin dueño';
  const user = await adminAuth().getUser(ownerUid);
  if (Boolean(user.customClaims?.companyApproved) === approved) return 'igual';
  await adminAuth().setCustomUserClaims(ownerUid, {
    ...user.customClaims,
    companyApproved: approved,
  });
  return 'actualizado';
}

async function main() {
  const companies = await companyModel.listAll();
  const counts = { actualizado: 0, igual: 0, 'sin dueño': 0, error: 0 };
  for (const c of companies) {
    const approved = c.status === 'APPROVED';
    try {
      // Rellena el índice de CIF únicos de las empresas anteriores a companyTaxIds (idempotente).
      // Si el CIF ya apunta a otra empresa no se sobrescribe: se avisa para revisarlo a mano.
      if (c.taxId) {
        const entry = await companyTaxIdModel.findById(c.taxId);
        if (entry?.companyId && entry.companyId !== c.id) {
          console.warn(
            `${c.id}: AVISO companyTaxIds/${c.taxId} ya apunta a ${entry.companyId}; no se sobrescribe`,
          );
        } else {
          await companyTaxIdModel.upsert(c.taxId, { taxId: c.taxId, companyId: c.id });
        }
      }
      const result = await syncOwner(c.ownerUid, approved);
      counts[result] += 1;
      console.log(`${c.id}: companyApproved=${approved} (${result})`);
    } catch (err) {
      counts.error += 1;
      console.error(`${c.id}: error (${err.code ?? err.message})`);
    }
  }
  console.log(`Hecho: ${companies.length} empresas.`, counts);
  console.log('Cada dueño debe refrescar el token (getIdToken(true)) o volver a entrar.');
}

main().catch((err) => {
  console.error('Error al sincronizar los claims:', err.message);
  process.exit(1);
});
