// Validación del mapa público de una planta: id en la URL y fecha, hora, personas y equipamiento opcionales.
import { fechaQuery, horaQuery, idParam } from './commonValidator.js';
import { equipamiento, personas, sinCorchetes } from './buildingValidator.js';

// sinCorchetes rechaza hora[], personas[x]…: Express no las agrupa y se ignorarían sin avisar.
export const getById = [sinCorchetes, idParam, fechaQuery, horaQuery, personas, equipamiento];
