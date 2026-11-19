// Validación de edificios públicos: id en la URL y fecha opcional para el detalle.
import { fechaQuery, idParam } from './commonValidator.js';

export const getById = [idParam, fechaQuery];
