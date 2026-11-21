// Panel de empresa: alta, edificios, plantas, detección con IA, guardar y publicar mapas, salas, reservas y bloqueos.
import { del, get, patch, post } from './apiClient.js';

// Empresa del usuario autenticado (la API la saca del token):
// { id, nombreEmpresa, cif, contacto, telefono, emailContacto, ciudad, estado, motivo, fechaSolicitud }.
// `estado`: pendiente, aprobada, rechazada o suspendida; `motivo`: de rechazo o suspensión, o null;
// `fechaSolicitud`: ISO o null. Funciona aunque la empresa no esté aprobada.
export function getMyCompany(options) {
  return get('/companies/me', options);
}

// Resumen del panel (GET /company/summary, solo empresa aprobada; si no, 403 COMPANY_NOT_APPROVED):
// { primerAcceso, truncado?, mes, cifras: { edificios, salasPublicadas, reservasMes, ingresosMes },
//   proximasReservas: [{ id, codigo, fecha, inicio, fin, importe, estado, sala: { nombre, codigo },
//   cliente: { nombre, email } }] (hasta 5), tareas: { plantasSinPublicar: [{ id, nombre, numero, buildingId,
//   edificio, sinMapa }], salasSinPrecio y salasSinFotos: [{ id, nombre, codigo, floorId, buildingId }],
//   totales: { plantasSinPublicar, salasSinPrecio, salasSinFotos } } }. Las listas de tareas llegan recortadas a 50.
export function getSummary(options) {
  return get('/company/summary', options);
}

// Edita los datos de la solicitud («Editar datos» si está pendiente; «Corregir y reenviar» si está rechazada, que la
// devuelve a pendiente). `datos`: cualquiera de { nombreEmpresa, cif, contacto, telefono, emailContacto, ciudad };
// responde con la misma forma que getMyCompany. Aprobada o suspendida: solo contacto, telefono y emailContacto
// (400 FIELD_NOT_EDITABLE). Errores: 409 COMPANY_EXISTS y 400 VALIDATION_ERROR.
export function updateMyCompany(datos, options) {
  return patch('/companies/me', datos, options);
}

// Edificios de la empresa con sus plantas (GET /company/buildings):
// [{ id, nombre, direccion, ciudad, descripcion, fotos, publicado,
//   plantas: [{ id, numero, nombre, publicado, salas }] }]. Las plantas llegan ordenadas por número; `salas` cuenta
// las activas. No incluye lo eliminado.
export function getBuildings(options) {
  return get('/company/buildings', options);
}

// Publica un edificio (necesita al menos una planta publicada: si no, 400 NO_PUBLISHED_FLOORS).
export function publishBuilding(id, options) {
  return post(`/company/buildings/${encodeURIComponent(id)}/publish`, undefined, options);
}

// Despublica un edificio. No cancela reservas: si tiene reservas futuras la respuesta trae un `aviso` en texto.
export function unpublishBuilding(id, options) {
  return post(`/company/buildings/${encodeURIComponent(id)}/unpublish`, undefined, options);
}

// Elimina un edificio con sus plantas y salas. Si alguna sala tiene reservas futuras no borra nada y responde
// 409 HAS_FUTURE_BOOKINGS con `details.reservasFuturas` (cuántas).
export function deleteBuilding(id, options) {
  return del(`/company/buildings/${encodeURIComponent(id)}`, options);
}

// Crea una planta en un edificio propio. `datos`: { numero (entero de -10 a 200, la posición), nombre }.
// Responde { id, buildingId, numero, nombre, publicado }; 409 FLOOR_EXISTS si ese número ya está ocupado.
export function createFloor(buildingId, datos, options) {
  return post(`/company/buildings/${encodeURIComponent(buildingId)}/floors`, datos, options);
}
