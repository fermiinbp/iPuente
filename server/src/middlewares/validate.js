// Recoge el resultado de los validators de express-validator y, si hay errores, responde 400 VALIDATION_ERROR con el detalle por campo.
import { validationResult } from 'express-validator';

import { HttpError } from '../utils/httpError.js';

export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const err = new HttpError(400, 'VALIDATION_ERROR', 'La petición no es válida');
  err.details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(err);
}

export default validate;
