// Corta la petición con 403 si el rol del usuario no es uno de los permitidos. Va siempre después de auth.
import { HttpError } from '../utils/httpError.js';

export function requireRole(...allowed) {
  return (req, res, next) => {
    // Defensa por si alguien monta requireRole sin auth delante.
    if (!req.user) {
      return next(new HttpError(401, 'NO_TOKEN', 'Falta el token de autenticación'));
    }
    if (!allowed.includes(req.user.role)) {
      return next(new HttpError(403, 'FORBIDDEN', 'No tienes permiso para acceder a este recurso'));
    }
    return next();
  };
}

export default requireRole;
