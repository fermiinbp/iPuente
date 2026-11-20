// Controlador de reservas y bloqueos del panel de empresa. Lee req, llama al service y responde; nunca habla con Firestore.
import * as service from '../services/companyBookingsService.js';

// Filtros opcionales de los listados.
const filters = (req) => ({
  desde: req.query.desde,
  hasta: req.query.hasta,
  roomId: req.query.roomId,
});

// GET /api/company/bookings: reservas de las salas de la empresa.
export async function listBookings(req, res) {
  res.json({ reservas: await service.listBookings(req.user.companyId, filters(req)) });
}

// GET /api/company/bookings/:id: detalle de una reserva de la empresa.
export async function getBooking(req, res) {
  res.json(await service.getBooking(req.user.companyId, req.params.id));
}

// GET /api/company/rooms/:id/future-bookings: reservas futuras de una sala propia.
export async function listFutureBookings(req, res) {
  res.json({ reservas: await service.listFutureBookings(req.user.companyId, req.params.id) });
}

// PATCH /api/company/bookings/:id/cancel: cancela una reserva de la empresa con motivo.
export async function cancelBooking(req, res) {
  res.json(await service.cancelBooking(req.user.companyId, req.params.id, req.body.motivo));
}

// GET /api/company/blocks: bloqueos de la empresa.
export async function listBlocks(req, res) {
  res.json({ bloqueos: await service.listBlocks(req.user.companyId, filters(req)) });
}

// POST /api/company/blocks: bloquea horas de una sala propia.
export async function createBlock(req, res) {
  const { roomId, fecha, inicio, fin, motivo } = req.body;
  const block = await service.createBlock(req.user.companyId, {
    roomId,
    fecha,
    inicio: Number.parseInt(inicio, 10),
    fin: Number.parseInt(fin, 10),
    motivo,
  });
  res.status(201).json(block);
}

// DELETE /api/company/blocks/:id: quita un bloqueo propio.
export async function removeBlock(req, res) {
  res.json(await service.removeBlock(req.user.companyId, req.params.id));
}
