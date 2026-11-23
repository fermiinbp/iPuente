// Controlador de cobros de la empresa (Stripe Connect). Lee req, llama al service y responde; nunca habla con Firestore.
import * as payoutsService from '../services/payoutsService.js';

// GET /api/company/payouts: estado de la cuenta de cobros propia.
export async function getPayouts(req, res) {
  res.json(await payoutsService.getPayouts(req.user.companyId));
}

// POST /api/company/payouts/onboarding: crea o continúa el alta y devuelve el enlace de Stripe.
export async function startOnboarding(req, res) {
  res.json(await payoutsService.startOnboarding(req.user.companyId));
}

// GET /api/company/payouts/movements: pagos de la empresa, paginados.
export async function listMovements(req, res) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  res.json(await payoutsService.listMovements(req.user.companyId, { page }));
}

// POST /api/company/payouts/dashboard: enlace al panel de Stripe de la empresa.
export async function createDashboardLink(req, res) {
  res.json(await payoutsService.createDashboardLink(req.user.companyId));
}
