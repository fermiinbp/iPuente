// Panel de empresa: alta, edificios, plantas, detección con IA, guardar y publicar mapas, salas, reservas y bloqueos.
import { get } from './apiClient.js';

// Empresa del usuario autenticado (la API la saca del token): { id, name, taxId, contactName, phone, email, estado, createdAt }.
// Funciona aunque la empresa aún no esté aprobada.
export function getMyCompany(options) {
  return get('/companies/me', options);
}
