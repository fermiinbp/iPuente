// Validación del panel de admin: filtro de estado, id de empresa y motivo de rechazo o suspensión.
import { body, query } from 'express-validator';

import { sinCorchetes } from './buildingValidator.js';
import { idParam } from './commonValidator.js';
import { dateQuery, rangeQuery } from './companyBookingsValidator.js';

const ESTADOS = ['pendiente', 'aprobada', 'rechazada', 'suspendida'];

export { idParam };

// Listado de empresas: estado opcional en español.
export const list = [
  sinCorchetes,
  query('estado')
    .optional()
    .custom((v) => typeof v === 'string')
    .withMessage('estado debe ser texto')
    .bail()
    .isIn(ESTADOS)
    .withMessage('estado debe ser pendiente, aprobada, rechazada o suspendida'),
];

// Motivo obligatorio de 3 a 500 caracteres (sin espacios sobrantes).
const motivo = body('motivo')
  .custom((v) => typeof v === 'string')
  .withMessage('motivo es obligatorio y debe ser texto')
  .bail()
  .trim()
  .isLength({ min: 3, max: 500 })
  .withMessage('motivo debe tener entre 3 y 500 caracteres');

export const reject = [idParam, motivo];
export const suspend = [idParam, motivo];
export const approve = [idParam];
export const reactivate = [idParam];

const isText = (v) => typeof v === 'string';

// Página opcional: entero entre 1 y 1000.
const pageQuery = query('page')
  .optional()
  .custom(isText)
  .bail()
  .isInt({ min: 1, max: 1000, allow_leading_zeroes: false })
  .withMessage('page debe ser un entero entre 1 y 1000');

// Listado de usuarios: rol (en inglés), búsqueda de hasta 100 caracteres y página.
export const listUsers = [
  sinCorchetes,
  query('rol')
    .optional()
    .custom(isText)
    .bail()
    .isIn(['CLIENT', 'COMPANY', 'ADMIN'])
    .withMessage('rol debe ser CLIENT, COMPANY o ADMIN'),
  query('q')
    .optional()
    .custom(isText)
    .withMessage('q debe ser texto')
    .bail()
    .isLength({ max: 100 })
    .withMessage('q admite hasta 100 caracteres'),
  pageQuery,
];

// Listado de reservas: estado (en inglés), rango de fechas, empresa y página.
export const listBookings = [
  sinCorchetes,
  query('estado')
    .optional()
    .custom(isText)
    .bail()
    .isIn(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED'])
    .withMessage('estado no es válido'),
  dateQuery('desde'),
  dateQuery('hasta'),
  rangeQuery,
  query('companyId')
    .optional()
    .custom(isText)
    .bail()
    .isLength({ min: 1, max: 128 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('companyId no es válido'),
  pageQuery,
];

export const getBooking = [idParam];
export const summary = [sinCorchetes];
