// Controlador de mapas: guardar y publicar. Lee req, llama al service y responde; nunca habla con Firestore.
import * as mapsService from '../services/mapsService.js';

// PUT /api/company/floors/:id/map: guarda el mapa de una planta propia.
export async function saveMap(req, res) {
  res.json(await mapsService.saveMap(req.user.companyId, req.params.id, req.body));
}

// POST /api/company/floors/:id/publish: publica una planta propia.
export async function publishFloor(req, res) {
  res.json(await mapsService.publishFloor(req.user.companyId, req.params.id));
}

// POST /api/company/floors/:id/unpublish: vuelve una planta propia a borrador.
export async function unpublishFloor(req, res) {
  res.json(await mapsService.unpublishFloor(req.user.companyId, req.params.id));
}
