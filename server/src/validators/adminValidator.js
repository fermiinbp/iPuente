// Validación del panel de admin: filtro de estado, id de empresa y motivo de rechazo o suspensión.
import { body, query } from 'express-validator';

import { sinCorchetes } from './buildingValidator.js';
import { idParam } from './commonValidator.js';

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
