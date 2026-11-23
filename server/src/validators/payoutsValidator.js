// Validación de los cobros de la empresa: ninguna acción admite parámetros y los movimientos solo `page`.
import { query } from 'express-validator';

import { sinCorchetes } from './buildingValidator.js';

// Rechaza cualquier clave de la query que no esté en `allowed` (no se ignoran en silencio).
const onlyQuery = (allowed) =>
  query().custom((value, { req }) => {
    const extra = Object.keys(req.query).find((k) => !allowed.includes(k));
    if (extra === undefined) return true;
    throw new Error(`${extra} no es un parámetro válido`);
  });

// Estado de cobros y acciones: sin parámetros.
export const noParams = [sinCorchetes, onlyQuery([])];

// Movimientos: `page` opcional, entero entre 1 y 25 (500 movimientos leídos / 20 por página).
export const movements = [
  sinCorchetes,
  onlyQuery(['page']),
  query('page')
    .optional()
    .custom((v) => typeof v === 'string')
    .withMessage('page debe ser un entero entre 1 y 25')
    .bail()
    .isInt({ min: 1, max: 25, allow_leading_zeroes: false })
    .withMessage('page debe ser un entero entre 1 y 25'),
];
