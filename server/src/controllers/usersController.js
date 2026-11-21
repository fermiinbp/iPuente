// Controlador del perfil de usuario. Lee req, llama al service y responde; nunca habla con Firestore.
import * as usersService from '../services/usersService.js';

// GET /api/users/me: devuelve el usuario autenticado con su nombre, apellidos y teléfono.
export async function getMe(req, res) {
  res.json(await usersService.getMe(req.user));
}

// PATCH /api/users/me: edita nombre, apellidos y teléfono del usuario autenticado.
export async function updateMe(req, res) {
  res.json(await usersService.updateMe(req.user, req.body));
}
