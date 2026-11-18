// Perfil de usuario y asignación de rol (CLIENT, COMPANY, ADMIN) mediante custom claims (role, companyId).
import { adminAuth } from '../config/config.js';
import { ROLE_VALUES } from '../config/roles.js';
import { HttpError } from '../utils/httpError.js';

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
