// Verifica el token de Firebase de la cabecera Authorization y deja en req.user el uid, el email, el rol y el companyId.
import { adminAuth } from '../config/config.js';
import { ROLE_VALUES, ROLES } from '../config/roles.js';
import { HttpError } from '../utils/httpError.js';

// Verificador por defecto. Se llama a adminAuth() solo al verificar, nunca al importar el módulo.
const defaultVerifier = (token) => adminAuth().verifyIdToken(token);

let verifyToken = defaultVerifier;

// Solo para tests: sustituye el verificador por un doble. Con null se restaura el de Firebase.
export function setTokenVerifier(fn) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setTokenVerifier solo se puede usar en tests');
  }
  verifyToken = typeof fn === 'function' ? fn : defaultVerifier;
}

// Extrae el token de "Authorization: Bearer <token>" (esquema sin distinguir mayúsculas). Si no hay, null.
function extractBearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

export async function auth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(new HttpError(401, 'NO_TOKEN', 'Falta el token de autenticación'));
  }

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    // Solo los errores de Firebase Auth son un token inválido; el resto (p. ej. sin credenciales) es un 500.
    if (typeof err?.code === 'string' && err.code.startsWith('auth/')) {
      return next(new HttpError(401, 'INVALID_TOKEN', 'El token no es válido o ha caducado'));
    }
    return next(err);
  }

  // Sin rol (o con uno desconocido) el usuario es cliente.
  const role = ROLE_VALUES.includes(decoded.role) ? decoded.role : ROLES.CLIENT;

  req.user = {
    uid: decoded.uid,
    email: decoded.email ?? null,
    role,
    // Solo se acepta un companyId de texto: cualquier otro valor del claim se ignora.
    companyId:
      typeof decoded.companyId === 'string' && decoded.companyId ? decoded.companyId : null,
  };
  return next();
}

export default auth;
