// Perfil del usuario autenticado: leerlo y editarlo. El correo no se puede cambiar.
import { get, patch } from './apiClient.js';

// { uid, email, role, companyId, nombre, apellidos, telefono } (nombre, apellidos y telefono pueden ser null).
export function getMe({ signal } = {}) {
  return get('/users/me', { signal });
}

// `datos`: cualquiera de { nombre, apellidos, telefono } (apellidos y telefono admiten null para borrarlos).
// Devuelve la misma forma que getMe, más `aviso` opcional. Error 400 VALIDATION_ERROR con details[].field.
export function updateMe(datos) {
  return patch('/users/me', datos);
}
