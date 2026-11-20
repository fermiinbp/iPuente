// Controlador del panel de admin. Lee req, llama al service y responde; nunca habla con Firestore.
import * as service from '../services/adminService.js';

// GET /api/admin/companies?estado=: lista de empresas.
export async function listCompanies(req, res) {
  res.json(await service.listCompanies({ estado: req.query.estado }));
}

// GET /api/admin/companies/:id: detalle de una empresa.
export async function getCompany(req, res) {
  res.json(await service.getCompany(req.params.id));
}

// POST /api/admin/companies/:id/approve: aprueba una empresa pendiente.
export async function approveCompany(req, res) {
  res.json(await service.approveCompany(req.params.id, req.user.uid));
}

// POST /api/admin/companies/:id/reject: rechaza una empresa pendiente con motivo.
export async function rejectCompany(req, res) {
  res.json(await service.rejectCompany(req.params.id, req.user.uid, req.body.motivo));
}

// POST /api/admin/companies/:id/suspend: suspende una empresa aprobada con motivo.
export async function suspendCompany(req, res) {
  res.json(await service.suspendCompany(req.params.id, req.user.uid, req.body.motivo));
}

// POST /api/admin/companies/:id/reactivate: reactiva una empresa suspendida.
export async function reactivateCompany(req, res) {
  res.json(await service.reactivateCompany(req.params.id, req.user.uid));
}
