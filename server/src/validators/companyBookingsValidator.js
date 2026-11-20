// Validación de reservas y bloqueos del panel de empresa: filtros de listado, crear bloqueo y cancelar.
import { body, query } from 'express-validator';

import { daysBetween, isValidDateString, resolveRange } from '../utils/dates.js';
import { fechaBody, finBody, inicioBody, roomIdBody } from './bookingValidator.js';
import { idParam } from './commonValidator.js';

const MAX_RANGE_DAYS = 366;

// Fecha opcional AAAA-MM-DD en la query.
export const dateQuery = (name) =>
  query(name)
    .optional()
    .custom((value) => isValidDateString(value))
    .withMessage(`${name} debe ser AAAA-MM-DD`);

// Con los valores por defecto aplicados (desde = hoy - 30 días, hasta = desde + 90), desde <= hasta
// y rango máximo de 366 días (ambos inclusive). Se aplica también con un solo extremo.
export const rangeQuery = query('hasta')
  .custom((_hasta, { req }) => {
    const { desde, hasta } = req.query;
    if ((desde && !isValidDateString(desde)) || (hasta && !isValidDateString(hasta))) return true;
    const range = resolveRange({ desde, hasta });
    const days = daysBetween(range.desde, range.hasta);
    return days >= 0 && days <= MAX_RANGE_DAYS - 1;
  })
  .withMessage('desde debe ser anterior o igual a hasta y el rango no puede pasar de 366 días');

const roomIdQuery = query('roomId')
  .optional()
  .isString()
  .trim()
  .isLength({ min: 1, max: 128 })
  .matches(/^[A-Za-z0-9_-]+$/)
  .withMessage('roomId no es válido');

// Motivo obligatorio: texto de 1 a max caracteres tras recortar espacios.
const motivo = (max) =>
  body('motivo')
    .isString()
    .withMessage('motivo es obligatorio')
    .bail()
    .trim()
    .isLength({ min: 1, max })
    .withMessage(`motivo debe tener entre 1 y ${max} caracteres`);

export const list = [dateQuery('desde'), dateQuery('hasta'), rangeQuery, roomIdQuery];
export const createBlock = [roomIdBody, fechaBody, inicioBody, finBody, motivo(200)];
export const detail = [idParam];
export const futureBookings = [idParam];
export const removeBlock = [idParam];
export const cancelBooking = [idParam, motivo(500)];
