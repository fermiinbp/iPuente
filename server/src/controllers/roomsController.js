// Controlador de fichas y disponibilidad de salas. Lee req, llama al service y responde; nunca habla con Firestore.
import * as roomsService from '../services/roomsService.js';

export async function getRoom(req, res) {
  res.json(await roomsService.getPublicRoom(req.params.id));
}

export async function getRoomAvailability(req, res) {
  res.json(await roomsService.getAvailability(req.params.id, req.query.fecha));
}
