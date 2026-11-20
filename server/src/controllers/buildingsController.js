// Controlador de edificios públicos. Lee req, llama al service y responde; nunca habla con Firestore.
import * as buildingsService from '../services/buildingsService.js';

// Convierte los filtros ya validados del buscador a número y lista (Express 5 no los muta).
export async function listBuildings(req, res) {
  const q = req.query;
  const num = (v) => (v === undefined ? undefined : Number(v));
  // Caché corta solo sin fecha: con fecha la disponibilidad cambia con cada reserva.
  if (q.fecha === undefined) res.set('Cache-Control', 'public, max-age=30');
  res.json(
    await buildingsService.searchPublished({
      ciudad: q.ciudad,
      personas: num(q.personas),
      equipamiento: q.equipamiento ? q.equipamiento.split(',') : [],
      fecha: q.fecha,
      tipo: q.tipo,
      precioMax: num(q.precioMax),
      orden: q.orden,
      page: num(q.page),
      limit: num(q.limit),
    }),
  );
}

export async function getBuilding(req, res) {
  res.json(await buildingsService.getPublished(req.params.id, req.query.fecha));
}
