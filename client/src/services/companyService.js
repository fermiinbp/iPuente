// Panel de empresa: alta, edificios, plantas, detección con IA, guardar y publicar mapas, salas, reservas y bloqueos.
import { get, patch } from './apiClient.js';

// Empresa del usuario autenticado (la API la saca del token):
// { id, name, taxId, contactName, phone, email, estado, motivo, createdAt }. `estado`: pendiente, aprobada,
// rechazada o suspendida; `motivo`: de rechazo o suspensión, o null. Funciona aunque la empresa no esté aprobada.
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
// devuelve a pendiente). `datos`: { nombreEmpresa, cif, contacto, telefono }, con los nombres del alta.
// TODO(DAT030): PATCH /api/companies/me todavía no existe (lo crea DAT030, #160); hasta entonces la API responde
// con error. Confirmar el body cuando exista y añadir emailContacto y ciudad.
export function updateMyCompany(datos, options) {
  return patch('/companies/me', datos, options);
}
