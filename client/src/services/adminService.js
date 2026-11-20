// Panel de admin: empresas, usuarios, reservas, pagos y reembolsos.
import { get, post } from './apiClient.js';

// Empresas, de la más reciente a la más antigua: { empresas: [{ id, nombre, cif, email, estado, fechaSolicitud,
// verificada }] }. `estado` (opcional): pendiente, aprobada, rechazada o suspendida; vacío = todas.
export function listCompanies(estado, options) {
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  return get(`/admin/companies${query}`, options);
}

// Transiciones de estado. Cada una devuelve la empresa actualizada y, si no se pudo actualizar la cuenta del dueño
// en Firebase Auth, `aviso`. Errores: 400 INVALID_TRANSITION (la empresa ya no está en el estado de partida) y
// 400 VALIDATION_ERROR (motivo de 3 a 500 caracteres, con `details`).
// pendiente → aprobada.
export function approveCompany(id, options) {
  return post(`/admin/companies/${encodeURIComponent(id)}/approve`, undefined, options);
}

// pendiente → rechazada, con motivo (la empresa lo ve en el estado de su solicitud).
export function rejectCompany(id, motivo, options) {
  return post(`/admin/companies/${encodeURIComponent(id)}/reject`, { motivo }, options);
}

// aprobada → suspendida, con motivo. Sus edificios dejan de verse; las reservas futuras no se cancelan:
// la respuesta trae `reservasFuturas` y `aviso`.
export function suspendCompany(id, motivo, options) {
  return post(`/admin/companies/${encodeURIComponent(id)}/suspend`, { motivo }, options);
}

// suspendida → aprobada: sus edificios publicados vuelven a verse.
export function reactivateCompany(id, options) {
  return post(`/admin/companies/${encodeURIComponent(id)}/reactivate`, undefined, options);
}
