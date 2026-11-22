// Controlador del panel de admin. Lee req, llama al service y responde; nunca habla con Firestore.
import * as service from '../services/adminService.js';
import * as paymentsAdmin from '../services/adminPaymentsService.js';

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
  res.json(await service.approveCompany(req.params.id, req.user.uid, req.body?.version));
}

// POST /api/admin/companies/:id/reject: rechaza una empresa pendiente con motivo.
export async function rejectCompany(req, res) {
  res.json(
    await service.rejectCompany(req.params.id, req.user.uid, req.body.motivo, req.body.version),
  );
}

// POST /api/admin/companies/:id/suspend: suspende una empresa aprobada con motivo.
export async function suspendCompany(req, res) {
  res.json(await service.suspendCompany(req.params.id, req.user.uid, req.body.motivo));
}

// POST /api/admin/companies/:id/reactivate: reactiva una empresa suspendida.
export async function reactivateCompany(req, res) {
  res.json(await service.reactivateCompany(req.params.id, req.user.uid));
}

// GET /api/admin/users?rol=&q=&page=: usuarios con búsqueda y paginación.
export async function listUsers(req, res) {
  const { rol, q, page } = req.query;
  res.json(await service.listUsers({ rol, q, page: page ? Number(page) : 1 }));
}

// GET /api/admin/bookings?estado=&desde=&hasta=&companyId=&page=: reservas de todas las empresas.
export async function listBookings(req, res) {
  const { estado, desde, hasta, companyId, page } = req.query;
  const filters = { estado, desde, hasta, companyId, page: page ? Number(page) : 1 };
  res.json(await service.listBookings(filters));
}

// GET /api/admin/bookings/:id: detalle de una reserva.
export async function getBooking(req, res) {
  res.json(await service.getBooking(req.params.id));
}

// GET /api/admin/summary: empresas por estado, usuarios por rol y reservas del mes.
export async function getSummary(req, res) {
  res.json(await service.getSummary());
}

// GET /api/admin/payments?estado=&page=: pagos con su reserva.
export async function listPayments(req, res) {
  const { estado, page } = req.query;
  res.json(await paymentsAdmin.listPayments({ estado, page: page ? Number(page) : 1 }));
}

// POST /api/admin/payments/:id/refund: reembolso total de un pago.
export async function refundPayment(req, res) {
  res.json(await paymentsAdmin.refundPayment(req.params.id));
}
