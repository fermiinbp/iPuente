// Controlador del registro. Lee req, llama al service y responde; nunca habla con Firestore.
import * as authService from '../services/authService.js';

// POST /api/auth/register/client: crea un cliente.
export async function registerClient(req, res) {
  const { email, password, nombre } = req.body;
  const result = await authService.registerClient({ email, password, nombre });
  res.status(201).json(result);
}

// POST /api/auth/google: alta de quien entra con Google (201 si crea la ficha, 200 si ya existía).
export async function googleSignIn(req, res) {
  const result = await authService.googleSignIn(req.user);
  res.status(result.creado ? 201 : 200).json(result);
}

// POST /api/auth/register/company: crea una empresa pendiente de aprobación.
export async function registerCompany(req, res) {
  const { email, password, nombre, nombreEmpresa, cif, contacto, telefono } = req.body;
  const { emailContacto, ciudad } = req.body;
  const result = await authService.registerCompany({
    email,
    password,
    nombre,
    nombreEmpresa,
    cif,
    contacto,
    telefono,
    emailContacto,
    ciudad,
  });
  res.status(201).json(result);
}
