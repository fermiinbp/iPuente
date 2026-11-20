// Deja pasar solo si la empresa del usuario está aprobada; la deja en req.company. Va tras auth y requireRole.
import * as companyModel from '../models/companyModel.js';
import { companyEstado } from '../services/companyService.js';
import { HttpError } from '../utils/httpError.js';

const MESSAGES = {
  pendiente: 'Tu empresa todavía no está aprobada',
  rechazada: 'La solicitud de tu empresa ha sido rechazada',
  suspendida: 'Tu empresa está suspendida',
};

export async function requireApprovedCompany(req, res, next) {
  if (!req.user) {
    return next(new HttpError(401, 'NO_TOKEN', 'Falta el token de autenticación'));
  }
  try {
    const company = req.user.companyId ? await companyModel.findById(req.user.companyId) : null;
    const estado = company ? companyEstado(company) : 'pendiente';
    if (estado !== 'aprobada') {
      return next(new HttpError(403, 'COMPANY_NOT_APPROVED', MESSAGES[estado]));
    }
    req.company = company;
    return next();
  } catch (err) {
    return next(err);
  }
}

export default requireApprovedCompany;
