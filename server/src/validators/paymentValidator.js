// Validación de pagos: checkout (id de la reserva en la URL, mismo formato que idParam).
import { param } from 'express-validator';

export const checkout = [
  param('bookingId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('bookingId es obligatorio')
    .isLength({ max: 128 })
    .withMessage('bookingId es demasiado largo')
    // Sin «/»: un id no puede apuntar a otra ruta de Firestore.
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('bookingId no es válido'),
];
