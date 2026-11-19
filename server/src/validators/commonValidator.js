// Reglas reutilizables: id en la URL, fecha AAAA-MM-DD en la query y franja horaria.
import { param, query } from 'express-validator';

import { isValidDateString } from '../utils/dates.js';

export const idParam = param('id')
  .isString()
  .trim()
  .notEmpty()
  .withMessage('id es obligatorio')
  .isLength({ max: 128 })
  .withMessage('id es demasiado largo');

export const fechaQuery = query('fecha')
  .optional()
  .custom((value) => isValidDateString(value))
  .withMessage('fecha debe ser AAAA-MM-DD');
