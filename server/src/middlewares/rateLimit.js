// Límites de peticiones: uno general para la API, uno estricto para el registro, otro para la detección con IA (cuesta dinero), otro para editar la empresa propia y otro para editar el perfil. Al superarlos responden 429 RATE_LIMITED con el formato de error común.
// El general cuenta en memoria de cada instancia (orientativo: no añade una escritura por petición).
// El de registro, el de IA, el de edición de la empresa propia (`companyEditLimiter`: 20 por hora por uid) y el del perfil (`profileEditLimiter`: 30 por hora por uid) usan un contador compartido en Firestore (FirestoreRateLimitStore). Los dos de edición fallan abierto y van después de `auth`.
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { isProductionEnv } from '../config/config.js';
import { HttpError } from '../utils/httpError.js';

import { FirestoreRateLimitStore } from './firestoreRateLimitStore.js';

const HOUR = 60 * 60 * 1000;

// Valores por defecto de cada límite (por IP, o por uid en la IA si hay sesión).
const DEFAULTS = {
  general: {
    limit: 300,
    windowMs: 15 * 60 * 1000,
    message: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.',
  },
  register: {
    limit: 10,
    windowMs: HOUR,
    message: 'Demasiados registros desde esta conexión. Inténtalo de nuevo más tarde.',
  },
  ai: {
    limit: 10,
    windowMs: HOUR,
    message: 'Has alcanzado el límite de detecciones con IA. Inténtalo de nuevo más tarde.',
  },
  profile: {
    limit: 30,
    windowMs: HOUR,
    message: 'Has editado tu perfil demasiadas veces. Inténtalo de nuevo más tarde.',
  },
  companyEdit: {
    limit: 20,
    windowMs: HOUR,
    message: 'Has editado la solicitud demasiadas veces. Inténtalo de nuevo más tarde.',
  },
  checkout: {
    limit: 20,
    windowMs: HOUR,
    message: 'Has iniciado demasiados pagos. Inténtalo de nuevo más tarde.',
  },
};

let overrides = null;
const instances = {};

// Los límites solo se saltan con NODE_ENV === 'test' exacto (lo fija tests/setup.js) y nunca en
// Vercel (VERCEL_ENV definido): cualquier otro caso los deja activos (fallar cerrado).
const isTestRun = () => process.env.NODE_ENV === 'test' && !process.env.VERCEL_ENV;

// IP del cliente: solo en Vercel (process.env.VERCEL definido) se lee x-vercel-forwarded-for, que la
// plataforma sobrescribe siempre (el cliente no puede falsearla); puede traer varias IP separadas
// por comas y se usa la primera. Fuera de Vercel la cabecera se ignora y se usa req.ip.
export function clientIp(req) {
  const header = process.env.VERCEL ? req.headers?.['x-vercel-forwarded-for'] : undefined;
  const first = (Array.isArray(header) ? header[0] : header)?.split(',')[0].trim();
  const ip = first || req.ip || '';
  return ipKeyGenerator(ip);
}

// Solo para tests: fija { general, register, ai, profile } con { limit, windowMs } y los activa.
// Con null se restauran los valores por defecto (desactivados en tests).
export function setRateLimitForTests(options) {
  if (isProductionEnv()) {
    throw new Error('setRateLimitForTests solo se puede usar en tests');
  }
  overrides = options ?? null;
  for (const name of Object.keys(instances)) delete instances[name];
}

// Store de cada límite. Registro: falla abierto (si Firestore cae, el registro tampoco puede
// escribir, así que no se pierde protección). IA: falla cerrado (503), porque cuesta dinero.
function storeFor(name) {
  if (name === 'register') return new FirestoreRateLimitStore({ prefix: name, failOpen: true });
  if (name === 'profile') return new FirestoreRateLimitStore({ prefix: name, failOpen: true });
  if (name === 'companyEdit') return new FirestoreRateLimitStore({ prefix: name, failOpen: true });
  if (name === 'checkout') return new FirestoreRateLimitStore({ prefix: name, failOpen: true });
  if (name === 'ai') return new FirestoreRateLimitStore({ prefix: name, failOpen: false });
  return undefined; // general: memoria por defecto
}

// Crea el limitador de express-rate-limit de un nombre.
// aiDetectLimiter y profileEditLimiter deben ir DESPUÉS de `auth` en la ruta: la clave es el uid (req.user.uid) y, si
// se pusiera antes, todos contarían por IP.
function build(name) {
  const { limit, windowMs, message } = { ...DEFAULTS[name], ...overrides?.[name] };
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: storeFor(name),
    keyGenerator: (req) =>
      ((name === 'ai' || name === 'companyEdit' || name === 'profile' || name === 'checkout') &&
        req.user?.uid) ||
      clientIp(req),
    handler: (req, res, next) => next(new HttpError(429, 'RATE_LIMITED', message)),
    // Se crea en la primera petición (para poder cambiarlo en tests) y se reutiliza: el aviso
    // ERR_ERL_CREATED_IN_REQUEST_HANDLER no aplica aquí y solo ensuciaría los logs.
    validate: { creationStack: false },
  });
}

// Middleware que crea el limitador la primera vez y se salta el límite en tests si no se activó.
function limiter(name) {
  return (req, res, next) => {
    if (!overrides?.[name] && isTestRun()) return next();
    instances[name] ??= build(name);
    return instances[name](req, res, next);
  };
}

export const generalLimiter = limiter('general');
export const registerLimiter = limiter('register');
export const aiDetectLimiter = limiter('ai');
export const profileEditLimiter = limiter('profile');
export const companyEditLimiter = limiter('companyEdit');
// Iniciar un pago (20 por hora por uid, falla abierto): va después de `auth`.
export const checkoutLimiter = limiter('checkout');
