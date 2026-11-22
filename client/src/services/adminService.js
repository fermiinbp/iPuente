// Panel de admin: empresas, usuarios, reservas, pagos y reembolsos.
import { get, post } from './apiClient.js';

// Empresas, de la más reciente a la más antigua: { empresas: [{ id, nombre, cif, email, estado, fechaSolicitud,
// verificada }] }. `estado` (opcional): pendiente, aprobada, rechazada o suspendida; vacío = todas.
export function listCompanies(estado, options) {
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  return get(`/admin/companies${query}`, options);
}

// Detalle de una empresa: { id, nombre, razonSocial, cif, email, telefono, direccion, descripcion, contacto, estado,
// verificada, motivo, fechaSolicitud, version, revisadaEn, dueno: { nombre, email } | null,
// edificios: [{ id, nombre, ciudad, publicado }] }. `ciudad` de la empresa aún no llega: si la API la añade, se
// muestra. 404 NOT_FOUND si no existe.
export function getCompany(id, options) {
  return get(`/admin/companies/${encodeURIComponent(id)}`, options);
}

// Transiciones de estado. Cada una devuelve la empresa actualizada y, si no se pudo actualizar la cuenta del dueño
// en Firebase Auth, `aviso`. Errores: 400 INVALID_TRANSITION (la empresa ya no está en el estado de partida) y
// 400 VALIDATION_ERROR (motivo de 3 a 500 caracteres, con `details`).
// pendiente → aprobada.
// `version` (opcional, la de la empresa cargada): si sus datos han cambiado desde entonces, 409 STALE_DATA.
export function approveCompany(id, { version } = {}, options) {
  const body = version ? { version } : undefined;
  return post(`/admin/companies/${encodeURIComponent(id)}/approve`, body, options);
}

// pendiente → rechazada, con motivo (la empresa lo ve en el estado de su solicitud). Mismo `version` que al aprobar.
export function rejectCompany(id, motivo, { version } = {}, options) {
  const body = version ? { motivo, version } : { motivo };
  return post(`/admin/companies/${encodeURIComponent(id)}/reject`, body, options);
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

// Pagos, de los más recientes a los más antiguos (20 por página): { pagos: [{ id, importe, moneda, estado,
// reembolsoPendiente, motivoReembolso, fecha, reembolsadoEn, reserva: { id, codigo, estado } | null,
// cliente: { nombre, email } | null }], total, page, limit, truncado }.
// `estado` (opcional): PENDING, SUCCEEDED, FAILED o REFUNDED; `page` de 1 a 25.
export function listPayments({ estado, page } = {}, options) {
  const query = new URLSearchParams();
  if (estado) query.set('estado', estado);
  if (page && page > 1) query.set('page', String(page));
  const text = query.toString();
  return get(`/admin/payments${text ? `?${text}` : ''}`, options);
}

// Reembolso total de un pago `SUCCEEDED`: { id, estado: 'REFUNDED', reserva: { id, estado }, yaReembolsado? }.
// Errores: 404 NOT_FOUND, 409 PAYMENT_NOT_REFUNDABLE, 502 PAYMENTS_ERROR (queda pendiente; se puede reintentar)
// y 503 PAYMENTS_UNAVAILABLE.
export function refundPayment(id, options) {
  return post(`/admin/payments/${encodeURIComponent(id)}/refund`, undefined, options);
}
