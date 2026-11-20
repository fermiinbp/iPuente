// Límites de peticiones: uno general para la API, uno estricto para el registro y otro para la detección con IA (cuesta dinero). Al superarlos responden 429 RATE_LIMITED con el formato de error común.
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { HttpError } from '../utils/httpError.js';

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

// Dentro de `node --test` los límites están desactivados salvo que un test los active.
const isTestRun = () => process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);

// Solo para tests: fija { general, register, ai } con { limit, windowMs } y los activa.
// Con null se restauran los valores por defecto (desactivados en tests).
export function setRateLimitForTests(options) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setRateLimitForTests solo se puede usar en tests');
  }
  overrides = options ?? null;
  for (const name of Object.keys(instances)) delete instances[name];
}

// Crea el limitador de express-rate-limit de un nombre.
function build(name) {
  const { limit, windowMs, message } = { ...DEFAULTS[name], ...overrides?.[name] };
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(name === 'ai' && {
      keyGenerator: (req) => req.user?.uid ?? ipKeyGenerator(req.ip ?? ''),
    }),
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
