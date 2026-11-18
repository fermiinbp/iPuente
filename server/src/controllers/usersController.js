// Controlador del perfil de usuario. Lee req, llama al service y responde; nunca habla con Firestore.

// GET /api/users/me: devuelve el usuario autenticado tal como lo deja el middleware auth.
export function getMe(req, res) {
  res.json(req.user);
}
