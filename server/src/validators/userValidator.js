// Validación del perfil de usuario: solo formato; las claves no permitidas las ignora el service.
import { body } from 'express-validator';

import { phone, text } from './authValidator.js';

const EDITABLES = ['nombre', 'apellidos', 'telefono'];

// Exige que llegue al menos uno de los campos editables.
const atLeastOne = body().custom((_, { req }) => {
  if (!EDITABLES.some((key) => req.body?.[key] !== undefined)) {
    throw new Error('Indica al menos nombre, apellidos o telefono');
  }
  return true;
});

// PATCH /users/me
export const updateMe = [
  atLeastOne,
  text('nombre').optional(),
  text('apellidos').optional({ values: 'null' }),
  phone('telefono').optional({ values: 'null' }),
];
