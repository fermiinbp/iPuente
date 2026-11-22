// Controlador del mapa público de una planta. Lee req, llama al service y responde; nunca habla con Firestore.
import * as floorsService from '../services/floorsService.js';
import { parseEquipamiento } from '../utils/roomNeeds.js';

// hora y personas llegan como texto en la query (ya validadas); sin ellas se quedan undefined.
export async function getFloor(req, res) {
  const { fecha, hora, personas, equipamiento } = req.query;
  const num = (v) => (v === undefined ? undefined : Number(v));
  const necesidades = { personas: num(personas), equipamiento: parseEquipamiento(equipamiento) };
  res.json(await floorsService.getPublishedMap(req.params.id, fecha, num(hora), necesidades));
}
