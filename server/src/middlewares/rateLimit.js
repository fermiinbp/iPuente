// Límites de peticiones: uno general para la API, uno estricto para el registro y otro para la detección con IA (cuesta dinero). Al superarlos responden 429 RATE_LIMITED con el formato de error común.
// El general cuenta en memoria de cada instancia (orientativo: no añade una escritura por petición).
// El de registro y el de IA usan un contador compartido en Firestore (FirestoreRateLimitStore).
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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
};

let overrides = null;
const instances = {};

// Los límites solo se saltan con NODE_ENV === 'test' exacto (lo fija tests/setup.js): cualquier otro
// valor, incluido uno ausente o 'production', los deja activos (fallar cerrado).
const isTestRun = () => process.env.NODE_ENV === 'test';

// IP del cliente: en Netlify x-nf-client-connection-ip la pone la plataforma y el cliente no puede
// falsearla; si no existe se usa req.ip (con trust proxy = 1).
export function clientIp(req) {
  const header = req.headers?.['x-nf-client-connection-ip'];
  const ip = (Array.isArray(header) ? header[0] : header) || req.ip || '';
  return ipKeyGenerator(ip);
}

// Solo para tests: fija { general, register, ai } con { limit, windowMs } y los activa.
// Con null se restauran los valores por defecto (desactivados en tests).
export function setRateLimitForTests(options) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setRateLimitForTests solo se puede usar en tests');
  }
  overrides = options ?? null;
  for (const name of Object.keys(instances)) delete instances[name];
}

// Store de cada límite. Registro: falla abierto (si Firestore cae, el registro tampoco puede
// escribir, así que no se pierde protección). IA: falla cerrado (503), porque cuesta dinero.
function storeFor(name) {
  if (name === 'register') return new FirestoreRateLimitStore({ prefix: name, failOpen: true });
  if (name === 'ai') return new FirestoreRateLimitStore({ prefix: name, failOpen: false });
  return undefined; // general: memoria por defecto
}

// Crea el limitador de express-rate-limit de un nombre.
// aiDetectLimiter debe ir DESPUÉS de `auth` en la ruta: la clave es el uid (req.user.uid) y, si
// se pusiera antes, todos contarían por IP.
function build(name) {
  const { limit, windowMs, message } = { ...DEFAULTS[name], ...overrides?.[name] };
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: storeFor(name),
    keyGenerator: (req) => (name === 'ai' && req.user?.uid) || clientIp(req),
    handler: (req, res, next) => next(new HttpError(429, 'RATE_LIMITED', message)),
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
