// Registro de clientes y empresas: crea el usuario en Firebase Auth, su ficha en Firestore y su rol (custom claim).
import { adminAuth } from '../config/config.js';
import { ROLES } from '../config/roles.js';
import * as companyModel from '../models/companyModel.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';

import { COMPANY_STATUS } from './companyService.js';

let testAuth = null;

// Solo para tests: sustituye Firebase Auth por un doble. Con null se restaura el real.
export function setAuthClientForTests(fake) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setAuthClientForTests solo se puede usar en tests');
  }
  testAuth = fake ?? null;
}

const authClient = () => testAuth ?? adminAuth();

// Traduce los errores de Firebase Auth a errores de la API; el resto pasa tal cual.
function translateAuthError(err) {
  switch (err?.code) {
    case 'auth/email-already-exists':
      return new HttpError(409, 'EMAIL_EXISTS', 'Ya existe una cuenta con ese email');
    case 'auth/invalid-password':
      return new HttpError(400, 'VALIDATION_ERROR', 'La contraseña no es válida');
    case 'auth/invalid-email':
      return new HttpError(400, 'VALIDATION_ERROR', 'El email no es válido');
    default:
      return err;
  }
}

// Crea el usuario en Auth traduciendo sus errores conocidos.
async function createAuthUser({ email, password, nombre }) {
  try {
    const user = await authClient().createUser({ email, password, displayName: nombre });
    return user.uid;
  } catch (err) {
    throw translateAuthError(err);
  }
}

// Deshace lo creado; si el propio rollback falla, solo se registran los ids para limpiar a mano.
async function rollback(uid, companyId) {
  if (companyId) {
    try {
      // Firestore no borra subcolecciones al borrar el documento: primero el miembro.
      await companyModel.removeMember(companyId, uid);
      await companyModel.remove(companyId);
    } catch {
      console.error(`Rollback del registro: no se pudo borrar la empresa ${companyId}`);
    }
  }
  try {
    // users/{uid} puede no existir todavía: borrar un documento inexistente no falla.
    await userModel.remove(uid);
  } catch {
    console.error(`Rollback del registro: no se pudo borrar users/${uid}`);
  }
  try {
    await authClient().deleteUser(uid);
  } catch {
    console.error(`Rollback del registro: no se pudo borrar el usuario de Auth ${uid}`);
  }
}

// Registra un cliente. Devuelve { uid }.
export async function registerClient({ email, password, nombre }) {
  const uid = await createAuthUser({ email, password, nombre });
  try {
    await authClient().setCustomUserClaims(uid, { role: ROLES.CLIENT });
    await userModel.create({ name: nombre, email, role: ROLES.CLIENT }, { id: uid });
    return { uid };
  } catch (err) {
    await rollback(uid);
    throw err;
  }
}

// Registra una empresa (queda pendiente de aprobación). Devuelve { uid, companyId, estado }.
export async function registerCompany(data) {
  const { email, password, nombre, nombreEmpresa, cif, contacto, telefono } = data;
  if (await companyModel.findByTaxId(cif)) {
    throw new HttpError(409, 'COMPANY_EXISTS', 'Ya existe una empresa con ese CIF');
  }

  const uid = await createAuthUser({ email, password, nombre });
  let companyId = null;
  try {
    companyId = await companyModel.create({
      name: nombreEmpresa,
      taxId: cif,
      contactName: contacto,
      phone: telefono,
      email,
      ownerUid: uid,
      status: COMPANY_STATUS.PENDING,
      verified: false,
    });
    await companyModel.setMember(companyId, uid, 'OWNER');
    await userModel.create({ name: nombre, email, role: ROLES.COMPANY }, { id: uid });
    await authClient().setCustomUserClaims(uid, { role: ROLES.COMPANY, companyId });
    return { uid, companyId, estado: 'pendiente' };
  } catch (err) {
    await rollback(uid, companyId);
    throw err;
  }
}
