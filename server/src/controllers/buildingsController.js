// Controlador de edificios públicos. Lee req, llama al service y responde; nunca habla con Firestore.
import * as buildingsService from '../services/buildingsService.js';

export async function listBuildings(req, res) {
  res.json(await buildingsService.listPublished());
}

export async function getBuilding(req, res) {
  res.json(await buildingsService.getPublished(req.params.id, req.query.fecha));
}
