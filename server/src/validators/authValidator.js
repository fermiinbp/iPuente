// Validación del registro: formato de email, contraseña, nombres, CIF español y teléfono.
import { body } from 'express-validator';

import { isValidCif, normalizeCif } from '../utils/cif.js';

// Caracteres de control y de dirección de texto (bidi), que no son válidos en un nombre.
export const INVALID_CHARS = /\p{Cc}|[\u202A-\u202E\u2066-\u2069]/u;

// Aplica .optional() a una cadena de validación si hace falta.
const maybe = (chain, optional) => (optional ? chain.optional() : chain);

// Texto obligatorio, recortado y con máximo de caracteres (lo reutiliza userValidator).
export const text = (field, max = 100, { optional = false } = {}) =>
  maybe(body(field), optional)
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

const emailField = (field, { optional = false } = {}) =>
  maybe(body(field), optional)
    .isString()
    .withMessage(`${field} es obligatorio`)
    .bail()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage(`${field} no es válido`)
    .isLength({ max: 254 })
    .withMessage(`${field} es demasiado largo`);

const email = emailField('email');

const password = body('password')
  .isString()
  .withMessage('password es obligatoria')
  .isLength({ min: 8, max: 128 })
  .withMessage('password debe tener entre 8 y 128 caracteres');

const cifField = ({ optional = false } = {}) =>
  maybe(body('cif'), optional)
    .isString()
    .withMessage('cif es obligatorio')
    .bail()
    .isLength({ max: 20 })
    .withMessage('cif es demasiado largo')
    .bail()
    .customSanitizer(normalizeCif)
    .custom(isValidCif)
    .withMessage('cif no es válido');

// Teléfono español de 9 dígitos (lo reutiliza userValidator).
export const phone = (field = 'telefono', { optional = false } = {}) =>
  maybe(body(field), optional)
    .isString()
    .withMessage(`${field} es obligatorio`)
    .bail()
    .customSanitizer((value) => value.replace(/\s/g, ''))
    .matches(/^[6-9]\d{8}$/)
    .withMessage(`${field} debe tener 9 dígitos y empezar por 6, 7, 8 o 9`);

const telefonoField = ({ optional = false } = {}) => phone('telefono', { optional });

// Ciudad: texto de 2 a 100 caracteres tras recortar.
const ciudadField = ({ optional = false } = {}) =>
  text('ciudad', 100, { optional })
    .bail()
    .isLength({ min: 2 })
    .withMessage('ciudad debe tener al menos 2 caracteres');

// Campos editables de la empresa propia (PATCH /companies/me).
export const COMPANY_EDITABLE_FIELDS = [
  'nombreEmpresa',
  'cif',
  'contacto',
  'telefono',
  'emailContacto',
  'ciudad',
];

// Exige que el body solo traiga campos editables y al menos uno.
const onlyEditableFields = body().custom((value) => {
  const keys = Object.keys(value ?? {});
  const unknown = keys.filter((k) => !COMPANY_EDITABLE_FIELDS.includes(k));
  if (unknown.length) throw new Error(`Campos no permitidos: ${unknown.join(', ')}`);
  if (!keys.length) throw new Error(`Envía al menos uno de: ${COMPANY_EDITABLE_FIELDS.join(', ')}`);
  return true;
});

// POST /auth/register/client
export const registerClient = [email, password, text('nombre')];

// POST /auth/register/company
export const registerCompany = [
  email,
  password,
  text('nombre'),
  text('nombreEmpresa'),
  cifField(),
  text('contacto'),
  telefonoField(),
  emailField('emailContacto'),
  ciudadField(),
  body('aceptaCondiciones')
    .custom((value) => value === true)
    .withMessage('Debes aceptar las condiciones'),
];

// POST /auth/google: el body debe estar vacío (el rol nunca se elige).
export const googleSignIn = [
  body().custom((value) => {
    // Sin body (undefined en Express 5) o un objeto vacío: vale. Cualquier otra cosa, no.
    if (value === undefined) return true;
    const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject || Object.keys(value).length > 0) {
      throw new Error('Esta petición no admite body');
    }
    return true;
  }),
];

// PATCH /companies/me: todos opcionales, al menos uno y solo los de la lista blanca.
export const updateMe = [
  onlyEditableFields,
  text('nombreEmpresa', 100, { optional: true }),
  cifField({ optional: true }),
  text('contacto', 100, { optional: true }),
  telefonoField({ optional: true }),
  emailField('emailContacto', { optional: true }),
  ciudadField({ optional: true }),
];
