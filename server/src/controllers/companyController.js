// Controlador del panel de empresa. Lee req, llama al service y responde; nunca habla con Firestore.
import * as companyService from '../services/companyService.js';

// GET /api/companies/me: empresa del usuario autenticado.
export async function getMyCompany(req, res) {
  res.json(await companyService.getMyCompany(req.user.companyId));
}
