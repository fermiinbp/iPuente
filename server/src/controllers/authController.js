// Controlador del registro. Lee req, llama al service y responde; nunca habla con Firestore.
import * as authService from '../services/authService.js';

// POST /api/auth/register/client: crea un cliente.
export async function registerClient(req, res) {
  const { email, password, nombre } = req.body;
  const result = await authService.registerClient({ email, password, nombre });
  res.status(201).json(result);
}

// POST /api/auth/register/company: crea una empresa pendiente de aprobación.
export async function registerCompany(req, res) {
  const { email, password, nombre, nombreEmpresa, cif, contacto, telefono } = req.body;
  const result = await authService.registerCompany({
    email,
    password,
    nombre,
    nombreEmpresa,
    cif,
    contacto,
    telefono,
  });
  res.status(201).json(result);
}
