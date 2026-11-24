// Validación del panel de empresa: alta, edificios, plantas, datos de sala y bloqueos.
import { body, query } from 'express-validator';

import { sinCorchetes } from './buildingValidator.js';
import { idParam, normalizeStorageUrl, storageImageUrl } from './commonValidator.js';

// Exige un valor escalar (no array ni objeto) para que express-validator no valide por elemento.
const scalarNumber = (field) => (v) => {
  if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) return true;
  throw new Error(`${field} debe ser un número`);
};

// Texto obligatorio u opcional con trim y longitud máxima.
function text(field, max, { required = true } = {}) {
  const chain = body(field);
  if (!required) chain.optional();
  return chain
    .custom((v) => typeof v === 'string')
    .withMessage(`${field} debe ser texto`)
    .bail()
    .isString()
    .withMessage(`${field} debe ser texto`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${field} no puede estar vacío`)
    .isLength({ max })
    .withMessage(`${field} admite como máximo ${max} caracteres`);
}

const descripcion = body('descripcion')
  .optional()
  .custom((v) => typeof v === 'string')
  .withMessage('descripcion debe ser texto')
  .bail()
  .bail()
  .trim()
  .isLength({ max: 2000 })
  .withMessage('descripcion admite como máximo 2000 caracteres');

const fotos = body('fotos')
  .optional()
  .isArray({ max: 20 })
  .withMessage('fotos debe ser una lista de hasta 20 URLs');

const fotosItems = body('fotos.*').custom(storageImageUrl).customSanitizer(normalizeStorageUrl);

const numero = (required) => {
  const chain = body('numero');
  if (!required) chain.optional();
  return chain
    .custom(scalarNumber('numero'))
    .bail()
    .isInt({ min: -10, max: 200 })
    .withMessage('numero debe ser un entero entre -10 y 200')
    .toInt();
};

// Exige al menos uno de los campos permitidos en el body.
function atLeastOne(fields) {
  return body().custom((value) => {
    if (fields.some((f) => value && value[f] !== undefined)) return true;
    throw new Error(`Envía al menos uno de: ${fields.join(', ')}`);
  });
}

// Coordenada opcional (null la quita): número o texto numérico dentro del rango; se guarda como número.
const coordinate = (field, limit) =>
  body(field)
    .optional({ values: 'null' })
    .custom(scalarNumber(field))
    .bail()
    .isFloat({ min: -limit, max: limit })
    .withMessage(`${field} debe ser un número entre -${limit} y ${limit}`)
    .toFloat();

// Latitud y longitud van juntas: las dos ausentes, las dos null o las dos con valor.
const coordinatesTogether = body('longitud').custom((_, { req }) => {
  const { latitud, longitud } = req.body ?? {};
  const state = (v) => (v === undefined ? 'absent' : v === null ? 'null' : 'value');
  if (state(latitud) === state(longitud)) return true;
  throw new Error('latitud y longitud deben enviarse juntas (las dos con valor o las dos null)');
});

const coordinates = [coordinate('latitud', 90), coordinate('longitud', 180), coordinatesTogether];

const BUILDING_FIELDS = [
  'nombre',
  'direccion',
  'ciudad',
  'descripcion',
  'fotos',
  'latitud',
  'longitud',
];
const FLOOR_FIELDS = ['numero', 'nombre'];
const ROOM_FIELDS = [
  'nombre',
  'capacidad',
  'm2',
  'precioHora',
  'gratis',
  'equipamiento',
  'reservable',
  'fotos',
];

export const createBuilding = [
  text('nombre', 100),
  text('direccion', 200),
  text('ciudad', 100),
  descripcion,
  fotos,
  fotosItems,
  ...coordinates,
];

export const updateBuilding = [
  idParam,
  atLeastOne(BUILDING_FIELDS),
  text('nombre', 100, { required: false }),
  text('direccion', 200, { required: false }),
  text('ciudad', 100, { required: false }),
  descripcion,
  fotos,
  fotosItems,
  ...coordinates,
];

export const createFloor = [idParam, numero(true), text('nombre', 100)];

export const updateFloor = [
  idParam,
  atLeastOne(FLOOR_FIELDS),
  numero(false),
  text('nombre', 100, { required: false }),
];

export const updateRoom = [
  idParam,
  atLeastOne(ROOM_FIELDS),
  text('nombre', 100, { required: false }),
  body('capacidad')
    .optional()
    .custom(scalarNumber('capacidad'))
    .bail()
    .isInt({ min: 1, max: 1000 })
    .withMessage('capacidad debe ser un entero entre 1 y 1000')
    .toInt(),
  body('m2')
    .optional()
    .custom(scalarNumber('m2'))
    .bail()
    .isFloat({ gt: 0, max: 100000 })
    .withMessage('m2 debe ser un número mayor que 0 (máx. 100000)')
    .toFloat(),
  body('precioHora')
    .optional()
    .custom(scalarNumber('precioHora'))
    .bail()
    .isFloat({ gt: 0, max: 10000 })
    .withMessage('precioHora debe ser un número mayor que 0 (máx. 10000)')
    .toFloat(),
  body('gratis')
    .optional()
    .custom((v) => typeof v === 'boolean')
    .withMessage('gratis debe ser true o false')
    .bail()
    .custom((value, { req }) => {
      if (value === true && req.body.precioHora !== undefined) {
        throw new Error('gratis y precioHora no pueden enviarse a la vez');
      }
      return true;
    }),
  body('equipamiento')
    .optional()
    .isArray({ max: 30 })
    .withMessage('equipamiento debe ser una lista de hasta 30 elementos'),
  body('equipamiento.*')
    .isString()
    .bail()
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .withMessage('cada elemento de equipamiento debe ser texto de 1 a 50 caracteres'),
  body('reservable')
    .optional()
    .custom((v) => typeof v === 'boolean')
    .withMessage('reservable debe ser true o false')
    .bail()
    .isBoolean({ strict: true })
    .withMessage('reservable debe ser true o false'),
  fotos,
  fotosItems,
];

export const buildingIdOnly = [idParam];
export const deleteResource = [idParam];

const idQuery = (field) =>
  query(field)
    .optional()
    .isString()
    .bail()
    .matches(/^[A-Za-z0-9_-]{1,128}$/)
    .withMessage(`${field} no es válido`);

export const listRooms = [
  idQuery('buildingId'),
  idQuery('floorId'),
  query('estado')
    .optional()
    .isString()
    .bail()
    .isIn(['publicada', 'sin_precio', 'oculta', 'zona_comun'])
    .withMessage('estado debe ser publicada, sin_precio, oculta o zona_comun'),
];

// Resumen del panel: no admite parámetros (ni con corchetes ni desconocidos) para no ignorarlos en silencio.
export const summary = [
  sinCorchetes,
  query().custom((value, { req }) => {
    const clave = Object.keys(req.query)[0];
    if (clave === undefined) return true;
    throw new Error(`${clave} no es un parámetro válido: el resumen no admite filtros`);
  }),
];

export const setRoomVisibility = [
  idParam,
  body('visible')
    .custom((v) => typeof v === 'boolean')
    .withMessage('visible debe ser true o false'),
];
