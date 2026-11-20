// Validación de reservas del cliente: crear (roomId, fecha, inicio, fin), detalle y cancelar (id en la URL).
import { body } from 'express-validator';

import { isValidDateString, todayString } from '../utils/dates.js';
import { idParam } from './commonValidator.js';

// Id de la sala en el body, con el mismo formato que idParam.
export const roomIdBody = body('roomId')
  .isString()
  .trim()
  .notEmpty()
  .withMessage('roomId es obligatorio')
  .isLength({ max: 128 })
  .withMessage('roomId es demasiado largo')
  .matches(/^[A-Za-z0-9_-]+$/)
  .withMessage('roomId no es válido');

// Fecha real AAAA-MM-DD que no sea anterior a hoy.
export const fechaBody = body('fecha')
  .custom((value) => isValidDateString(value))
  .withMessage('fecha debe ser AAAA-MM-DD')
  .bail()
  .custom((value) => value >= todayString())
  .withMessage('fecha no puede ser anterior a hoy');

export const inicioBody = body('inicio')
  .isInt({ min: 0, max: 23 })
  .withMessage('inicio debe ser un entero entre 0 y 23')
  .bail()
  // Si la fecha es hoy, la franja no puede haber empezado ya.
  .custom(
    (value, { req }) => req.body.fecha !== todayString() || Number(value) > new Date().getHours(),
  )
  .withMessage('No se puede reservar una franja que ya ha empezado');

export const finBody = body('fin')
  .isInt({ min: 1, max: 24 })
  .withMessage('fin debe ser un entero entre 1 y 24')
  .bail()
  .custom((value, { req }) => Number(value) > Number(req.body.inicio))
  .withMessage('fin debe ser mayor que inicio');

export const create = [roomIdBody, fechaBody, inicioBody, finBody];
export const detail = [idParam];
export const cancel = [idParam];
