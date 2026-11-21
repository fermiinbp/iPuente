// Perfil de usuario y asignación de rol (CLIENT, COMPANY, ADMIN) mediante custom claims (role, companyId).
import { adminAuth } from '../config/config.js';
import { ROLE_VALUES } from '../config/roles.js';
import { runTransaction } from '../models/baseModel.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { authClient } from './authService.js';

const EDITABLES = ['nombre', 'apellidos', 'telefono'];

// Vista del perfil: datos del token más nombre, apellidos y teléfono de users/{uid} (null si faltan).
function toProfile(user, doc) {
  return {
    uid: user.uid,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    nombre: doc?.name ?? null,
    apellidos: doc?.surname ?? null,
    telefono: doc?.phone ?? null,
  };
}

// Perfil del usuario autenticado (GET /users/me).
export async function getMe(user) {
  return toProfile(user, await userModel.findById(user.uid));
}

// Rol para una ficha nueva: el de los claims actuales de Auth o, si no se pueden leer, el del token.
async function roleForNewDoc(user) {
  try {
    const record = await authClient().getUser(user.uid);
    const role = record?.customClaims?.role;
    if (ROLE_VALUES.includes(role)) return role;
  } catch (err) {
    console.error('No se pudo leer el rol de la cuenta', err?.code);
  }
  return user.role;
}

// Edita nombre, apellidos y teléfono propios (lista blanca: el resto de claves se ignora). Lee y
// escribe en una transacción. Si no hay ficha (cuentas de Google) la crea con el email, el rol de los
// claims y, si no llega nombre, el del token. Solo sincroniza displayName si cambia nombre o apellidos.
export async function updateMe(user, body = {}) {
  const input = Object.fromEntries(
    EDITABLES.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]),
  );
  // Fuera de la transacción: el rol de una ficha nueva (nunca se toca el de una existente).
  const newRole = (await userModel.findById(user.uid)) ? null : await roleForNewDoc(user);

  const { doc } = await runTransaction(async (tx) => {
    const current = await userModel.findById(user.uid, { tx });
    const data = {};
    if ('nombre' in input) data.name = input.nombre;
    if ('apellidos' in input) data.surname = input.apellidos;
    if ('telefono' in input) data.phone = input.telefono;
    if (!current) {
      data.email = user.email;
      data.role = newRole ?? user.role;
      if (!('nombre' in input) && user.name) data.name = user.name;
    }
    await userModel.upsert(user.uid, data, { tx });
    return { doc: { ...current, ...data } };
  });

  const profile = toProfile(user, doc);
  if (!('nombre' in input) && !('apellidos' in input)) return profile;
  const displayName = `${doc.name ?? ''} ${doc.surname ?? ''}`.trim();
  try {
    await authClient().updateUser(user.uid, { displayName: displayName || null });
  } catch (err) {
    console.error('No se pudo actualizar displayName', err?.code);
    return {
      ...profile,
      aviso: 'Los datos se han guardado, pero el nombre de la cuenta se actualizará más tarde.',
    };
  }
  return profile;
}

// Asigna el rol (y la empresa, si viene) a un usuario existente conservando el resto de sus claims.
// Solo lo usan los scripts de administración: ningún endpoint deja que un usuario cambie su propio rol.
export async function setUserRole(email, role, companyId = null) {
  if (!ROLE_VALUES.includes(role)) {
    throw new HttpError(
      400,
      'INVALID_ROLE',
      `Rol no válido: ${role}. Usa ${ROLE_VALUES.join(', ')}.`,
    );
  }

  const user = await adminAuth().getUserByEmail(email);

  const claims = { ...user.customClaims, role };
  if (companyId) {
    claims.companyId = companyId;
  } else {
    delete claims.companyId;
  }

  await adminAuth().setCustomUserClaims(user.uid, claims);
  return { uid: user.uid, email: user.email, role };
}
