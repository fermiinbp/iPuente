// Registro de clientes y empresas: crea el usuario en Firebase Auth, su ficha en Firestore y su rol (custom claim).
import { adminAuth, isProductionEnv } from '../config/config.js';
import { ROLE_VALUES, ROLES } from '../config/roles.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as companyModel from '../models/companyModel.js';
import * as companyTaxIdModel from '../models/companyTaxIdModel.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { INVALID_CHARS } from '../validators/authValidator.js';

import { COMPANY_STATUS } from './companyService.js';

let testAuth = null;

// Solo para tests: sustituye Firebase Auth por un doble. Con null se restaura el real.
export function setAuthClientForTests(fake) {
  if (isProductionEnv()) {
    throw new Error('setAuthClientForTests solo se puede usar en tests');
  }
  testAuth = fake ?? null;
}

// Cliente de Auth (el real o el doble de los tests); lo reutiliza adminService.
export const authClient = () => testAuth ?? adminAuth();

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

const isAlreadyExists = (err) =>
  err?.code === 6 || err?.code === 'already-exists' || /ALREADY_EXISTS/.test(err?.message ?? '');

const inconsistent = () =>
  new HttpError(
    409,
    'ACCOUNT_INCONSISTENT',
    'Tu cuenta tiene un estado inconsistente. Contacta con soporte.',
  );

// Nombre del token de Google listo para la ficha: sin control ni bidi, espacios colapsados, recortado
// y de hasta 100 caracteres (por puntos de código, sin partir pares sustitutos). null si queda vacío.
function cleanName(name) {
  if (typeof name !== 'string') return null;
  const spaced = name.replace(new RegExp(INVALID_CHARS.source, 'gu'), ' ');
  const clean = spaced.replace(/\s+/g, ' ').trim();
  const cut = Array.from(clean).slice(0, 100).join('').trim();
  return cut || null;
}

// Un intento del alta con Google: lee el claim fresco y, en una transacción, crea la ficha si falta
// sin tocar nunca un rol existente. Devuelve { rol, creado, repararClaim, claims } sin escribir claims.
async function googleSignInAttempt(user) {
  const record = await authClient().getUser(user.uid);
  const claims = record?.customClaims ?? {};
  const claimRole = ROLE_VALUES.includes(claims.role) ? claims.role : null;
  // Un claim con rol inválido se trata como sin rol (no escala); solo se avisa con el uid.
  if (claims.role !== undefined && !claimRole) {
    console.warn(`Alta con Google: la cuenta ${user.uid} tiene un claim de rol no válido`);
  }
  // Sin claim, quien es dueño de una empresa no puede pasar por cliente.
  if (!claimRole && (await companyModel.findByOwnerUids([user.uid])).length > 0) {
    throw inconsistent();
  }
  const outcome = await runTransaction(async (tx) => {
    const profile = await userModel.findById(user.uid, { tx });
    if (profile) {
      if (claimRole) return { rol: claimRole, creado: false, repararClaim: false };
      if (profile.role !== ROLES.CLIENT) throw inconsistent();
      return { rol: ROLES.CLIENT, creado: false, repararClaim: true };
    }
    // El claim manda: la ficha nueva refleja su rol (no concede nada) y, sin claim, es CLIENT.
    const rol = claimRole ?? ROLES.CLIENT;
    const data = { email: user.email, role: rol };
    const name = cleanName(user.name);
    if (name) data.name = name;
    await userModel.create(data, { id: user.uid, tx });
    return { rol, creado: true, repararClaim: !claimRole };
  });
  return { ...outcome, claims };
}

// Alta con Google (POST /auth/google). Idempotente: crea users/{uid} y el claim CLIENT solo si faltan
// y nunca cambia un rol existente. Devuelve { uid, rol, creado, refrescarToken }.
export async function googleSignIn(user) {
  if (user.signInProvider !== 'google.com') {
    throw new HttpError(403, 'GOOGLE_REQUIRED', 'Esta operación solo está disponible con Google');
  }
  if (user.emailVerified !== true) {
    throw new HttpError(
      403,
      'EMAIL_NOT_VERIFIED',
      'El correo de tu cuenta de Google no está verificado',
    );
  }
  let outcome;
  try {
    outcome = await googleSignInAttempt(user);
  } catch (err) {
    // Dos llamadas simultáneas: la otra creó la ficha entre medias; se repite y ya la encuentra.
    if (!isAlreadyExists(err)) throw err;
    outcome = await googleSignInAttempt(user);
  }
  if (outcome.repararClaim) {
    try {
      // Auth no tiene compare-and-swap: releer reduce la ventana con make-admin, pero no la elimina.
      const fresh = (await authClient().getUser(user.uid))?.customClaims ?? {};
      if (ROLE_VALUES.includes(fresh.role)) {
        return { uid: user.uid, rol: fresh.role, creado: outcome.creado, refrescarToken: true };
      }
      await authClient().setCustomUserClaims(user.uid, { ...fresh, role: ROLES.CLIENT });
    } catch (err) {
      // La ficha ya existe: la siguiente llamada repara el claim. No se filtran detalles.
      console.error('Alta con Google: no se pudo asignar el rol', err?.code);
      throw new HttpError(
        500,
        'ROLE_ASSIGN_FAILED',
        'No se ha podido completar el alta. Inténtalo de nuevo.',
      );
    }
  }
  return {
    uid: user.uid,
    rol: outcome.rol,
    creado: outcome.creado,
    refrescarToken: outcome.repararClaim,
  };
}

// Corta con 409 EMAIL_IS_CLIENT si el email ya es de un cliente (Auth o users).
async function assertEmailNotClient(email) {
  let existing = null;
  try {
    existing = await authClient().getUserByEmail(email);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  if (!existing) return;
  const profile = await userModel.findById(existing.uid);
  if (existing.customClaims?.role === ROLES.CLIENT || profile?.role === ROLES.CLIENT) {
    throw new HttpError(
      409,
      'EMAIL_IS_CLIENT',
      'Ese email ya tiene una cuenta de cliente. Usa otro email para la empresa.',
    );
  }
}

// Un CIF reservado sin companyId más viejo que esto se considera huérfano (registro caído a medias).
const ORPHAN_TAX_ID_MS = 10 * 60 * 1000;

// Milisegundos de una fecha que puede ser Date o Timestamp de Firestore (0 si falta).
const toMillis = (value) =>
  typeof value?.toMillis === 'function' ? value.toMillis() : +value || 0;

// Dice si la reserva de un CIF quedó huérfana: sin companyId y de hace más de 10 minutos, o con un
// companyId que apunta a una empresa que ya no existe.
export async function isOrphanTaxId(entry, tx) {
  if (!entry.companyId) return Date.now() - toMillis(entry.createdAt) > ORPHAN_TAX_ID_MS;
  return !(await companyModel.findById(entry.companyId, { tx }));
}

// Reserva el CIF en una transacción. Si ya existe y no es huérfano: 409 COMPANY_EXISTS; si es
// huérfano lo sobrescribe y continúa. Dos registros simultáneos no pueden quedarse ambos con él.
async function reserveTaxId(cif) {
  try {
    await runTransaction(async (tx) => {
      const entry = await companyTaxIdModel.findById(cif, { tx });
      if (!entry) return companyTaxIdModel.create({ taxId: cif }, { id: cif, tx });
      if (await isOrphanTaxId(entry, tx)) {
        return companyTaxIdModel.overwrite(cif, { taxId: cif }, { tx });
      }
      throw new HttpError(409, 'COMPANY_EXISTS', 'Ya existe una empresa con ese CIF');
    });
  } catch (err) {
    if (companyTaxIdModel.isAlreadyExists(err)) {
      throw new HttpError(409, 'COMPANY_EXISTS', 'Ya existe una empresa con ese CIF');
    }
    throw err;
  }
}

// Libera el CIF reservado (reintenta una vez); si falla solo se registra para limpiar a mano.
// Decisión: rechazar o suspender una empresa NO libera su CIF; solo se libera si el registro falla.
async function releaseTaxId(cif) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await companyTaxIdModel.remove(cif);
      return;
    } catch {
      if (attempt === 2) {
        console.error(`Rollback del registro: no se pudo borrar companyTaxIds/${cif}`);
      }
    }
  }
}

// Registra una empresa (queda pendiente de aprobación). Devuelve { uid, companyId, estado }.
export async function registerCompany(data) {
  const { email, password, nombre, nombreEmpresa, cif, contacto, telefono } = data;
  const { emailContacto, ciudad } = data;
  // Comprobaciones previas amigables; la unicidad real del CIF la garantiza reserveTaxId.
  if (await companyModel.findByTaxId(cif)) {
    throw new HttpError(409, 'COMPANY_EXISTS', 'Ya existe una empresa con ese CIF');
  }
  await assertEmailNotClient(email);
  await reserveTaxId(cif);

  let uid;
  try {
    uid = await createAuthUser({ email, password, nombre });
  } catch (err) {
    await releaseTaxId(cif);
    throw err;
  }
  let companyId = null;
  try {
    companyId = await companyModel.create({
      name: nombreEmpresa,
      taxId: cif,
      contactName: contacto,
      phone: telefono,
      email: emailContacto,
      city: ciudad,
      termsAcceptedAt: now(),
      ownerUid: uid,
      status: COMPANY_STATUS.PENDING,
      verified: false,
    });
    await companyTaxIdModel.update(cif, { companyId });
    await companyModel.setMember(companyId, uid, 'OWNER');
    await userModel.create({ name: nombre, email, role: ROLES.COMPANY }, { id: uid });
    await authClient().setCustomUserClaims(uid, {
      role: ROLES.COMPANY,
      companyId,
      companyApproved: false,
    });
    return { uid, companyId, estado: 'pendiente' };
  } catch (err) {
    await rollback(uid, companyId);
    await releaseTaxId(cif);
    throw err;
  }
}
