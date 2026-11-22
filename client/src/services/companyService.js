// Panel de empresa: alta, edificios, plantas, detección con IA, guardar y publicar mapas, salas, reservas y bloqueos.
import { ApiError, del, get, patch, post, put } from './apiClient.js';

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

// Un edificio propio con sus plantas, la misma forma que cada elemento de getBuildings. La API no tiene
// GET /company/buildings/:id, así que se busca en el listado; si no está (no existe, es de otra empresa o se
// eliminó) responde como la API: ApiError 404 NOT_FOUND.
// TODO(back): usar GET /company/buildings/:id cuando exista (docs/back-pendiente-emp.md, EMP004).
export async function getBuilding(id, options) {
  const buildings = await getBuildings(options);
  const building = buildings.find((b) => b.id === id);
  if (!building) throw new ApiError(404, 'NOT_FOUND', 'No encontramos este edificio.');
  return building;
}

// Crea un edificio en borrador. `datos`: { nombre, direccion, ciudad, descripcion?, fotos? } (fotos: URLs de
// Storage de la empresa, la primera es la fachada). Responde { id, nombre, direccion, ciudad, descripcion, fotos,
// publicado: false }, sin plantas.
export function createBuilding(datos, options) {
  return post('/company/buildings', datos, options);
}

// Edita un edificio propio (cualquiera de los campos de createBuilding; al menos uno). No cambia si está publicado.
export function updateBuilding(id, datos, options) {
  return patch(`/company/buildings/${encodeURIComponent(id)}`, datos, options);
}

// Edita una planta propia: { numero?, nombre? } (al menos uno). 409 FLOOR_EXISTS si el número ya es de otra planta
// del edificio.
export function updateFloor(id, datos, options) {
  return patch(`/company/floors/${encodeURIComponent(id)}`, datos, options);
}

// Elimina una planta propia con sus salas. 409 HAS_FUTURE_BOOKINGS (con `details.reservasFuturas`) si alguna sala
// tiene reservas futuras: no borra nada.
export function deleteFloor(id, options) {
  return del(`/company/floors/${encodeURIComponent(id)}`, options);
}

// Edita los datos para el cliente de una sala propia: { precioHora? (> 0) | gratis?, capacidad? (1–1000),
// m2? (> 0), equipamiento? (lista de textos), reservable? }. `gratis` y `precioHora` no van juntos; un precio nuevo
// quita «gratis». 400 ROOM_WITHOUT_PRICE si quedaría reservable sin precio. El código, el nombre y el tipo NO se
// editan aquí: van con el mapa (saveFloorMap), que los copia a la sala al guardar.
export function updateRoom(id, datos, options) {
  return patch(`/company/rooms/${encodeURIComponent(id)}`, datos, options);
}

// Reservas futuras (confirmadas o pendientes de pago) de una sala propia. La API responde { reservas: [...] };
// aquí se devuelve solo la lista.
export async function getRoomFutureBookings(id, options) {
  const data = await get(`/company/rooms/${encodeURIComponent(id)}/future-bookings`, options);
  return Array.isArray(data?.reservas) ? data.reservas : [];
}

// Mapa de una planta propia para el editor (aunque esté en borrador). Lo que se espera de la API:
// GET /company/floors/:id → { id, buildingId, numero, nombre, publicado, ancho, alto, origen, salas, mapImageUrl }.
// Sin mapa guardado: `salas: []` y `ancho`, `alto`, `origen` y `mapImageUrl` a `null`. Una planta que no existe o es
// ajena responde el mismo 404.
export function getFloorMap(floorId, options) {
  return get(`/company/floors/${encodeURIComponent(floorId)}`, options);
}

// Guarda el mapa de una planta propia (PUT /company/floors/:id/map). `mapa`: { ancho, alto, origen ('manual' o
// 'ia'), salas: [{ id, codigo, nombre, tipo, x, y, w, h }], mapImageUrl? }. Sustituye el mapa entero: las salas que
// ya no están se marcan como no reservables. Errores: 400 VALIDATION_ERROR (con el campo de cada error) y
// 409 ROOM_ID_TAKEN si un id de sala es de otra planta.
export function saveFloorMap(floorId, mapa, options) {
  return put(`/company/floors/${encodeURIComponent(floorId)}/map`, mapa, options);
}

// Salas activas de la empresa (GET /company/rooms), ordenadas por edificio, planta y código. Cada una:
// { id, buildingId, floorId, codigo, nombre, capacidad, m2, precioHora (null si es gratis o no tiene), gratis,
// equipamiento, reservable, fotos, estado }. `filtros` (opcionales): { buildingId, floorId, estado } (estado:
// publicada, sin_precio u oculta).
export function getRooms(filtros = {}, options) {
  const params = new URLSearchParams();
  for (const key of ['buildingId', 'floorId', 'estado']) {
    if (filtros[key]) params.set(key, filtros[key]);
  }
  const query = params.toString();
  return get(`/company/rooms${query ? `?${query}` : ''}`, options);
}

// Filtros comunes de reservas y bloqueos: `desde` y `hasta` (AAAA-MM-DD, inclusive; máximo 366 días; sin ellos,
// de hoy − 30 días a 90 días después) y `roomId`. Los vacíos no se envían.
function rangeQuery({ desde, hasta, roomId } = {}) {
  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  if (roomId) params.set('roomId', roomId);
  const query = params.toString();
  return query ? `?${query}` : '';
}

// Reservas de las salas de la empresa (como mucho 500). Cada una: { id, codigo, roomId, fecha, inicio, fin, horas,
// precioHora, importe, estado, sala: { nombre, codigo }, cliente: { nombre, email }, motivoCancelacion?, canceladaPor? }.
// La API responde { reservas: [...] }; aquí se devuelve solo la lista.
export async function getBookings(filtros, options) {
  const data = await get(`/company/bookings${rangeQuery(filtros)}`, options);
  return Array.isArray(data?.reservas) ? data.reservas : [];
}

// Detalle de una reserva propia (GET /company/bookings/:id): { id, codigo, fecha, inicio, fin, horas, precioHora,
// importe, estado, sala: { id, codigo, nombre }, planta, edificio, cliente: { nombre, email }, canceladaPor?,
// motivoCancelacion? }. 404 NOT_FOUND si no existe o es de otra empresa.
export function getBooking(id, options) {
  return get(`/company/bookings/${encodeURIComponent(id)}`, options);
}

// Cancela una reserva propia con un motivo (1–500): responde { id, estado: 'CANCELLED', motivo }.
// 400 BOOKING_NOT_CANCELLABLE si no está confirmada y 400 BOOKING_STARTED si ya ha empezado.
export function cancelBooking(id, motivo, options) {
  return patch(`/company/bookings/${encodeURIComponent(id)}/cancel`, { motivo }, options);
}

// Bloqueos de horas de la empresa (como mucho 500). Cada uno: { id, roomId, sala, fecha, inicio, fin, motivo }.
// La API responde { bloqueos: [...] }; aquí se devuelve solo la lista.
export async function getBlocks(filtros, options) {
  const data = await get(`/company/blocks${rangeQuery(filtros)}`, options);
  return Array.isArray(data?.bloqueos) ? data.bloqueos : [];
}

// Bloquea horas de una sala propia: { roomId, fecha (no pasada), inicio, fin (8–20, inicio < fin), motivo (1–200) }.
// 409 SLOT_TAKEN si choca con una reserva u otro bloqueo; 409 BUSY si hay mucha actividad (reintentar).
export function createBlock(datos, options) {
  return post('/company/blocks', datos, options);
}

// Quita un bloqueo propio y libera sus horas.
export function deleteBlock(id, options) {
  return del(`/company/blocks/${encodeURIComponent(id)}`, options);
}

// Muestra u oculta una sala propia (PATCH /company/rooms/:id/visibility, body { visible }). Responde la sala con su
// `estado` y, al ocultar con reservas futuras, `reservasFuturas` y un `aviso` (no se cancelan).
// 400 ROOM_WITHOUT_PRICE si se quiere mostrar sin precio ni «gratis»; 400 ROOM_INACTIVE si ya no está en el mapa.
export function setRoomVisibility(id, visible, options) {
  return patch(`/company/rooms/${encodeURIComponent(id)}/visibility`, { visible }, options);
}
