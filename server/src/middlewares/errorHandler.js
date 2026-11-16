// Respuesta de error única { error: { code, message, details } } y 404 para rutas que no existen. Oculta el detalle de los 500.
import { HttpError } from '../utils/httpError.js';

// 404 para cualquier ruta que no exista.
export const notFound = (req, res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `No existe la ruta ${req.method} ${req.originalUrl}`));
};

// Manejador de errores final: siempre responde { error: { code, message } }.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // JSON mal formado en el body (lo lanza express.json()).
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({
        error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido' },
      });
  }

  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (status >= 500) {
    console.error(err);
    return res
      .status(status)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
  }

  const body = { code: err.code || 'ERROR', message: err.message };
  if (err.details) body.details = err.details;
  return res.status(status).json({ error: body });
};
