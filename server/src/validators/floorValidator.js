// Validación del mapa público de una planta: id en la URL y fecha y hora opcionales.
import { query } from 'express-validator';

import { fechaQuery, horaQuery, idParam } from './commonValidator.js';

// Rechaza claves como hora[] o hora[a]: Express no las agrupa en `hora` y se ignorarían sin avisar.
const horaSinCorchetes = query('hora')
  .custom((_, { req }) => !Object.keys(req.query).some((k) => k.startsWith('hora[')))
  .withMessage('hora debe ser un entero entre 8 y 19');

export const getById = [idParam, fechaQuery, horaQuery, horaSinCorchetes];
