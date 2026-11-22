// Controlador de reservas del cliente. Lee req, llama al service y responde; nunca habla con Firestore.
import * as bookingsService from '../services/bookingsService.js';

// Crea una reserva. Solo pasa roomId, fecha, inicio y fin: importe, estado y dueño los fija el servidor.
export async function createBooking(req, res) {
  const { roomId, fecha, inicio, fin } = req.body;
  const booking = await bookingsService.createBooking(
    req.user.uid,
    { roomId, fecha, inicio: Number.parseInt(inicio, 10), fin: Number.parseInt(fin, 10) },
    { pendingPayment: true },
  );
  res.status(201).json(booking);
}

// Lista las reservas del usuario autenticado, separadas en próximas y pasadas.
export async function listMyBookings(req, res) {
  res.json(await bookingsService.listMyBookings(req.user.uid));
}

// Detalle de una reserva propia.
export async function getMyBooking(req, res) {
  res.json(await bookingsService.getMyBooking(req.user.uid, req.params.id));
}

// Cancela una reserva propia.
export async function cancelBooking(req, res) {
  res.json(await bookingsService.cancelBooking(req.user.uid, req.params.id));
}
