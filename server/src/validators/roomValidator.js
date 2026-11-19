// Validación de salas públicas: id en la URL y fecha opcional para la disponibilidad.
import { fechaQuery, idParam } from './commonValidator.js';

export const getById = [idParam];
export const availability = [idParam, fechaQuery];
