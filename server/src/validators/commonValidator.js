// Reglas reutilizables: id en la URL, fecha AAAA-MM-DD en la query y franja horaria.
import { param, query } from 'express-validator';

import { BOOKING_HOURS } from '../config/bookingHours.js';
import { config } from '../config/config.js';
import { isValidDateString } from '../utils/dates.js';

export const idParam = param('id')
  .isString()
  .trim()
  .notEmpty()
  .withMessage('id es obligatorio')
  .isLength({ max: 128 })
  .withMessage('id es demasiado largo')
  // Solo letras, números, guion y guion bajo: así un id con «/» no puede apuntar a otra ruta de Firestore.
  .matches(/^[A-Za-z0-9_-]+$/)
  .withMessage('id no es válido');

export const fechaQuery = query('fecha')
  .optional()
  .custom((value) => isValidDateString(value))
  .withMessage('fecha debe ser AAAA-MM-DD');

// Hora entera del horario reservable (8-19); rechaza decimales, texto y listas (hora[]=).
export const horaQuery = query('hora')
  .optional()
  .custom((value) => typeof value === 'string' || typeof value === 'number')
  .withMessage('hora debe ser un entero entre 8 y 19')
  .bail()
  .isInt({ min: BOOKING_HOURS.desde, max: BOOKING_HOURS.hasta - 1, allow_leading_zeroes: false })
  .withMessage('hora debe ser un entero entre 8 y 19')
  .toInt();

const STORAGE_HOST = 'https://firebasestorage.googleapis.com';
const STORAGE_PREFIX = '/v0/b/';

// Comprueba que value es una URL de descarga del bucket del proyecto dentro de companies/{companyId}/.
// Devuelve el mensaje de error o null si es válida.
export function storageImageUrlError(value, companyId) {
  if (!config.storageBucket) return 'El almacenamiento de imágenes no está configurado';
  const invalid = 'Debe ser una URL de una imagen subida a tu carpeta de Firebase Storage';
  if (typeof value !== 'string' || value.length > 2048) return invalid;
  let url;
  try {
    url = new URL(value);
  } catch {
    return invalid;
  }
  if (url.origin !== STORAGE_HOST || !url.pathname.startsWith(STORAGE_PREFIX)) return invalid;
  if (url.hash !== '' || value.includes('#')) return invalid;
  // Solo alt=media y token (una vez cada uno): cualquier otro parámetro se rechaza.
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    const valid =
      key === 'alt' ? values[0] === 'media' : key === 'token' && /^[\w-]+$/.test(values[0]);
    if (values.length !== 1 || !valid) return invalid;
  }
  const rest = url.pathname.slice(STORAGE_PREFIX.length);
  const [bucket, o, ...segments] = rest.split('/');
  if (bucket !== config.storageBucket || o !== 'o' || segments.length !== 1) return invalid;
  let path;
  try {
    path = decodeURIComponent(segments[0]);
  } catch {
    return invalid;
  }
  const clean =
    !path.includes('..') && !path.includes(String.fromCharCode(92)) && !path.includes('//');
  if (!companyId || !clean || !path.startsWith(`companies/${companyId}/`)) return invalid;
  return null;
}

// Regla para validators: la URL debe ser una imagen del Storage del proyecto y de la empresa del token.
export const storageImageUrl = (value, { req }) => {
  const error = storageImageUrlError(value, req.user?.companyId);
  if (error) throw new Error(error);
  return true;
};

// Forma canónica de una URL de Storage ya validada: origen y ruta tal como los normaliza URL,
// con ?alt=media y, si viene, &token=... en ese orden. Si no es una URL, devuelve el valor tal cual.
export function normalizeStorageUrl(value) {
  if (typeof value !== 'string') return value;
  try {
    const url = new URL(value);
    const token = url.searchParams.get('token');
    return `${url.origin}${url.pathname}?alt=media${token ? `&token=${token}` : ''}`;
  } catch {
    return value;
  }
}
