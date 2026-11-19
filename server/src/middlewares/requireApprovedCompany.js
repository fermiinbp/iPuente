// Deja pasar solo si la empresa del usuario está aprobada; la deja en req.company. Va tras auth y requireRole.
import * as companyModel from '../models/companyModel.js';
import { companyEstado } from '../services/companyService.js';
import { HttpError } from '../utils/httpError.js';

export async function requireApprovedCompany(req, res, next) {
  if (!req.user) {
    return next(new HttpError(401, 'NO_TOKEN', 'Falta el token de autenticación'));
  }
  try {
    const company = req.user.companyId ? await companyModel.findById(req.user.companyId) : null;
    if (!company || companyEstado(company) !== 'aprobada') {
      return next(
        new HttpError(403, 'COMPANY_NOT_APPROVED', 'Tu empresa todavía no está aprobada'),
      );
    }
    req.company = company;
    return next();
  } catch (err) {
    return next(err);
  }
}

export default requireApprovedCompany;
