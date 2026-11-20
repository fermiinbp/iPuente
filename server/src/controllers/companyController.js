// Controlador del panel de empresa. Lee req, llama al service y responde; nunca habla con Firestore.
import * as companyService from '../services/companyService.js';
import * as deletionService from '../services/deletionService.js';

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

// POST /api/company/buildings/:id/publish: publica un edificio propio.
export async function publishBuilding(req, res) {
  res.json(await companyService.publishBuilding(req.user.companyId, req.params.id));
}

// POST /api/company/buildings/:id/unpublish: vuelve un edificio propio a borrador.
export async function unpublishBuilding(req, res) {
  res.json(await companyService.unpublishBuilding(req.user.companyId, req.params.id));
}

// GET /api/company/rooms: salas de la empresa con su estado.
export async function listRooms(req, res) {
  res.json(await companyService.listRooms(req.user.companyId, req.query));
}

// PATCH /api/company/rooms/:id/visibility: muestra u oculta una sala propia.
export async function setRoomVisibility(req, res) {
  res.json(
    await companyService.setRoomVisibility(req.user.companyId, req.params.id, req.body.visible),
  );
}

// DELETE /api/company/buildings/:id: elimina un edificio propio con sus plantas y salas.
export async function deleteBuilding(req, res) {
  res.json(await deletionService.deleteBuilding(req.user.companyId, req.params.id));
}

// DELETE /api/company/floors/:id: elimina una planta propia con sus salas.
export async function deleteFloor(req, res) {
  res.json(await deletionService.deleteFloor(req.user.companyId, req.params.id));
}

// DELETE /api/company/rooms/:id: elimina una sala propia.
export async function deleteRoom(req, res) {
  res.json(await deletionService.deleteRoom(req.user.companyId, req.params.id));
}
