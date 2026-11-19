// Reglas reutilizables: id en la URL, fecha AAAA-MM-DD en la query y franja horaria.
import { param, query } from 'express-validator';

import { BOOKING_HOURS } from '../config/bookingHours.js';
import { isValidDateString } from '../utils/dates.js';

export const idParam = param('id')
  .isString()
  .trim()
  .notEmpty()
  .withMessage('id es obligatorio')
  .isLength({ max: 128 })
  .withMessage('id es demasiado largo')
  // Solo letras, números, guion y guion bajo: así un id con «/» no puede apuntar a otra ruta de Firestore.
  .matches(/^[A-Za-z0-9_-]+$/)
  .withMessage('id no es válido');

export const fechaQuery = query('fecha')
  .optional()
  .custom((value) => isValidDateString(value))
  .withMessage('fecha debe ser AAAA-MM-DD');

// Hora entera del horario reservable (8-19); rechaza decimales, texto y listas (hora[]=).
export const horaQuery = query('hora')
  .optional()
  .custom((value) => typeof value === 'string' || typeof value === 'number')
  .withMessage('hora debe ser un entero entre 8 y 19')
  .bail()
  .isInt({ min: BOOKING_HOURS.desde, max: BOOKING_HOURS.hasta - 1, allow_leading_zeroes: false })
  .withMessage('hora debe ser un entero entre 8 y 19')
  .toInt();
