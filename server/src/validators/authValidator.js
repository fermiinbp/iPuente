// Validación del registro: formato de email, contraseña, nombres, CIF español y teléfono.
import { body } from 'express-validator';

import { isValidCif, normalizeCif } from '../utils/cif.js';

// Caracteres de control y de dirección de texto (bidi), que no son válidos en un nombre.
const INVALID_CHARS = /\p{Cc}|[‪-‮⁦-⁩]/u;

// Texto obligatorio, recortado y con máximo de caracteres (lo reutiliza userValidator).
export const text = (field, max = 100) =>
  body(field)
    .isString()
    .withMessage(`${field} es obligatorio`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${field} es obligatorio`)
    .isLength({ max })
    .withMessage(`${field} es demasiado largo`)
    .not()
    .matches(INVALID_CHARS)
    .withMessage(`${field} contiene caracteres no válidos`);

const email = body('email')
  .isString()
  .withMessage('email es obligatorio')
  .bail()
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage('email no es válido')
  .isLength({ max: 254 })
  .withMessage('email es demasiado largo');

const password = body('password')
  .isString()
  .withMessage('password es obligatoria')
  .isLength({ min: 8, max: 128 })
  .withMessage('password debe tener entre 8 y 128 caracteres');

const cif = body('cif')
  .isString()
  .withMessage('cif es obligatorio')
  .bail()
  .customSanitizer(normalizeCif)
  .custom(isValidCif)
  .withMessage('cif no es válido');

// Teléfono español de 9 dígitos (lo reutiliza userValidator).
export const phone = (field = 'telefono') =>
  body(field)
    .isString()
    .withMessage(`${field} es obligatorio`)
    .bail()
    .customSanitizer((value) => value.replace(/\s/g, ''))
    .matches(/^[6-9]\d{8}$/)
    .withMessage(`${field} debe tener 9 dígitos y empezar por 6, 7, 8 o 9`);

const telefono = phone('telefono');

// POST /auth/register/client
export const registerClient = [email, password, text('nombre')];

// POST /auth/register/company
export const registerCompany = [
  email,
  password,
  text('nombre'),
  text('nombreEmpresa'),
  cif,
  text('contacto'),
  telefono,
];
