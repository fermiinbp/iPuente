// Validación del mapa público de una planta: id en la URL y fecha opcional.
import { fechaQuery, idParam } from './commonValidator.js';

export const getById = [idParam, fechaQuery];
