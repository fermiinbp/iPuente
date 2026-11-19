// Controlador del mapa público de una planta. Lee req, llama al service y responde; nunca habla con Firestore.
import * as floorsService from '../services/floorsService.js';

export async function getFloor(req, res) {
  res.json(await floorsService.getPublishedMap(req.params.id, req.query.fecha));
}
