// Validación de edificios públicos: id en la URL y fecha opcional para el detalle, y filtros del buscador.
import { query } from 'express-validator';

import { HttpError } from '../utils/httpError.js';
import { normalizeText } from '../utils/text.js';
import { fechaQuery, idParam } from './commonValidator.js';

export const getById = [idParam, fechaQuery];

const isText = (v) => typeof v === 'string';
const isScalar = (v) => typeof v === 'string' || typeof v === 'number';

// Rechaza claves como ciudad[] o personas[a]: Express no las agrupa en el parámetro y se
// ignorarían sin avisar. El error apunta al nombre base de la clave (antes del corchete).
export function sinCorchetes(req, res, next) {
  const clave = Object.keys(req.query).find((k) => k.includes('['));
  if (clave === undefined) return next();
  const err = new HttpError(400, 'VALIDATION_ERROR', 'La petición no es válida');
  const field = clave.slice(0, clave.indexOf('[')) || 'query';
  err.details = [{ field, message: 'los parámetros no admiten corchetes' }];
  return next(err);
}

// Equipamiento en CSV: hasta 30 elementos; cada uno, tras normalizar, solo [a-z0-9_ -] y ≤ 50.
export const equipamiento = query('equipamiento')
  .optional()
  .custom(isText)
  .withMessage('equipamiento debe ser una lista separada por comas')
  .bail()
  .custom((value) => {
    const items = value.split(',');
    if (items.length > 30) return false;
    return items
      .map(normalizeText)
      .filter(Boolean)
      .every((item) => item.length <= 50 && /^[a-z0-9_ -]+$/.test(item));
  })
  .withMessage('equipamiento admite hasta 30 elementos de letras, números, espacio, _ y -');

// Personas (entero 1–1000); una lista o un parámetro repetido da 400.
export const personas = query('personas')
  .optional()
  .custom(isScalar)
  .withMessage('personas debe ser un entero entre 1 y 1000')
  .bail()
  .isInt({ min: 1, max: 1000, allow_leading_zeroes: false })
  .withMessage('personas debe ser un entero entre 1 y 1000');

// Filtros del buscador de edificios (todos opcionales).
export const search = [
  sinCorchetes,
  query('ciudad')
    .optional()
    .custom(isText)
    .withMessage('ciudad debe ser texto')
    .bail()
    .isLength({ max: 100 })
    .withMessage('ciudad admite hasta 100 caracteres'),
  personas,
  equipamiento,
  fechaQuery,
  query('tipo')
    .optional()
    .custom(isText)
    .bail()
    .isIn(['sala', 'box'])
    .withMessage('tipo debe ser sala o box'),
  query('precioMax')
    .optional()
    .custom(isScalar)
    .withMessage('precioMax debe ser un número mayor que 0 y como máximo 10000')
    .bail()
    .isFloat({ gt: 0, max: 10000 })
    .withMessage('precioMax debe ser un número mayor que 0 y como máximo 10000'),
  query('orden')
    .optional()
    .custom(isText)
    .bail()
    .isIn(['precio', 'salas'])
    .withMessage('orden debe ser precio o salas'),
  query('page')
    .optional()
    .custom(isScalar)
    .withMessage('page debe ser un entero entre 1 y 10000')
    .bail()
    .isInt({ min: 1, max: 10000, allow_leading_zeroes: false })
    .withMessage('page debe ser un entero entre 1 y 10000'),
  query('limit')
    .optional()
    .custom(isScalar)
    .withMessage('limit debe ser un entero entre 1 y 50')
    .bail()
    .isInt({ min: 1, max: 50, allow_leading_zeroes: false })
    .withMessage('limit debe ser un entero entre 1 y 50'),
];
