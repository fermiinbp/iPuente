// Controlador del mapa público de una planta. Lee req, llama al service y responde; nunca habla con Firestore.
import * as floorsService from '../services/floorsService.js';

// hora llega como texto en la query (ya validada como entero); sin hora se queda undefined.
export async function getFloor(req, res) {
  const { fecha, hora } = req.query;
  const horaNumero = hora === undefined ? undefined : Number(hora);
  res.json(await floorsService.getPublishedMap(req.params.id, fecha, horaNumero));
}
