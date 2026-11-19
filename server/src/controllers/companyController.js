// Controlador del panel de empresa. Lee req, llama al service y responde; nunca habla con Firestore.
import * as companyService from '../services/companyService.js';

// GET /api/companies/me: empresa del usuario autenticado.
export async function getMyCompany(req, res) {
  res.json(await companyService.getMyCompany(req.user.companyId));
}

// GET /api/company/buildings: edificios de la empresa.
export async function listBuildings(req, res) {
  res.json(await companyService.listBuildings(req.user.companyId));
}

// POST /api/company/buildings: crea un edificio.
export async function createBuilding(req, res) {
  res.status(201).json(await companyService.createBuilding(req.user.companyId, req.body));
}

// PATCH /api/company/buildings/:id: edita un edificio propio.
export async function updateBuilding(req, res) {
  res.json(await companyService.updateBuilding(req.user.companyId, req.params.id, req.body));
}

// POST /api/company/buildings/:id/floors: crea una planta en un edificio propio.
export async function createFloor(req, res) {
  res
    .status(201)
    .json(await companyService.createFloor(req.user.companyId, req.params.id, req.body));
}

// PATCH /api/company/floors/:id: edita una planta propia.
export async function updateFloor(req, res) {
  res.json(await companyService.updateFloor(req.user.companyId, req.params.id, req.body));
}

// PATCH /api/company/rooms/:id: edita los datos comerciales de una sala propia.
export async function updateRoom(req, res) {
  res.json(await companyService.updateRoom(req.user.companyId, req.params.id, req.body));
}
