// Validación del mapa público de una planta: id en la URL y fecha y hora opcionales.
import { fechaQuery, horaQuery, idParam } from './commonValidator.js';

export const getById = [idParam, fechaQuery, horaQuery];
