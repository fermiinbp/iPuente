// Validación de mapas: id de la planta y JSON del mapa (dimensiones y salas dentro del plano).
import { validationResult } from 'express-validator';

import { HttpError } from '../utils/httpError.js';
import { idParam } from './commonValidator.js';

export const ROOM_TYPES = ['sala', 'box', 'comun', 'cocina', 'pasillo'];
export const MAP_ORIGINS = ['manual', 'ia'];
export const MAX_ROOMS = 300;
const MAX_SIZE = 10000;
const ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const RESERVED_ID = /^__.*__$/;
const MAX_ERRORS = 50;

// Número real (no texto, ni array, ni NaN/Infinity).
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Texto no vacío (tras recortar) de hasta max caracteres.
const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// Errores de las dimensiones del plano y de su origen.
function validateSize(map) {
  const errors = [];
  for (const field of ['ancho', 'alto']) {
    if (!isNum(map[field]) || map[field] <= 0 || map[field] > MAX_SIZE) {
      errors.push({
        field,
        message: `${field} debe ser un número mayor que 0 y de hasta ${MAX_SIZE}`,
      });
    }
  }
  if (!MAP_ORIGINS.includes(map.origen)) {
    errors.push({ field: 'origen', message: "origen debe ser 'manual' o 'ia'" });
  }
  return errors;
}

// Errores de una sala (posición, tamaño y textos) dentro de un plano de ancho × alto.
function validateRoom(sala, i, map) {
  const f = (name) => `salas[${i}].${name}`;
  if (!isObject(sala)) return [{ field: `salas[${i}]`, message: 'La sala debe ser un objeto' }];
  const errors = [];
  if (typeof sala.id !== 'string' || !ID_REGEX.test(sala.id)) {
    errors.push({ field: f('id'), message: 'id debe tener 1-64 letras, números, «-» o «_»' });
  }
  if (typeof sala.id === 'string' && RESERVED_ID.test(sala.id)) {
    errors.push({ field: f('id'), message: 'id no puede empezar y acabar con «__»' });
  }
  if (!isText(sala.codigo, 50)) {
    errors.push({ field: f('codigo'), message: 'codigo es obligatorio (máx. 50 caracteres)' });
  }
  if (!isText(sala.nombre, 100)) {
    errors.push({ field: f('nombre'), message: 'nombre es obligatorio (máx. 100 caracteres)' });
  }
  if (!ROOM_TYPES.includes(sala.tipo)) {
    errors.push({ field: f('tipo'), message: `tipo debe ser uno de: ${ROOM_TYPES.join(', ')}` });
  }
  for (const k of ['x', 'y']) {
    if (!isNum(sala[k]) || sala[k] < 0) {
      errors.push({ field: f(k), message: `${k} debe ser un número mayor o igual que 0` });
    }
  }
  for (const k of ['w', 'h']) {
    if (!isNum(sala[k]) || sala[k] <= 0) {
      errors.push({ field: f(k), message: `${k} debe ser un número mayor que 0` });
    }
  }
  if (isNum(sala.x) && isNum(sala.w) && isNum(map.ancho) && sala.x + sala.w > map.ancho) {
    errors.push({ field: f('w'), message: 'La sala se sale del plano por la derecha' });
  }
  if (isNum(sala.y) && isNum(sala.h) && isNum(map.alto) && sala.y + sala.h > map.alto) {
    errors.push({ field: f('h'), message: 'La sala se sale del plano por abajo' });
  }
  return errors;
}

// Valida un mapa completo. Devuelve [{ field, message }]; vacío si es válido.
export function validateMap(map) {
  if (!isObject(map)) return [{ field: 'body', message: 'El mapa debe ser un objeto' }];
  const errors = validateSize(map);
  if (!Array.isArray(map.salas) || map.salas.length > MAX_ROOMS) {
    errors.push({ field: 'salas', message: `salas debe ser una lista de hasta ${MAX_ROOMS}` });
    return errors;
  }
  const seen = new Set();
  map.salas.forEach((sala, i) => {
    errors.push(...validateRoom(sala, i, map));
    if (isObject(sala) && typeof sala.id === 'string') {
      if (seen.has(sala.id)) errors.push({ field: `salas[${i}].id`, message: 'id repetido' });
      seen.add(sala.id);
    }
  });
  return errors.slice(0, MAX_ERRORS);
}

// Middleware: valida req.body como mapa y responde 400 VALIDATION_ERROR con el detalle por campo.
// Si el id de la URL ya falló, deja que lo recoja validate.
function checkMapBody(req, res, next) {
  if (!validationResult(req).isEmpty()) return next();
  const errors = validateMap(req.body);
  if (errors.length === 0) return next();
  const err = new HttpError(400, 'VALIDATION_ERROR', 'La petición no es válida');
  err.details = errors;
  return next(err);
}

export const saveMap = [idParam, checkMapBody];
export const publishFloor = [idParam];

export const unpublishFloor = [idParam];
