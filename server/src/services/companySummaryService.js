// Resumen del panel de empresa: cifras, próximas reservas y tareas pendientes de la empresa del token.
import * as bookingModel from '../models/bookingModel.js';
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import * as userModel from '../models/userModel.js';
import { monthRange } from '../utils/dates.js';
import { notDeleted } from '../utils/softDelete.js';
import { toItem } from './bookingsService.js';
import { toCliente, toSala } from './companyBookingsService.js';
import { roomEstado } from './companyService.js';
import { isActiveFuture } from './futureBookingsService.js';

// Próximas reservas que devuelve el resumen (se piden algunas más por si alguna se descarta).
const UPCOMING_LIMIT = 5;
const UPCOMING_FETCH = 10;
// Elementos de cada lista de tareas y tope de edificios, plantas y salas que se leen de la empresa
// (si se alcanza, la respuesta lleva `truncado: true` y las cifras y tareas pueden quedarse cortas).
const MAX_TASKS = 50;
const MAX_DOCS = 1000;
// Estados que cuentan como reserva e ingreso del mes (las canceladas, caducadas o sin pagar, no).
const BILLABLE = ['CONFIRMED', 'COMPLETED'];
// Estados de una reserva viva.
const ACTIVE = ['CONFIRMED', 'PENDING_PAYMENT'];

// Suma con dos decimales (evita 0.1 + 0.2 = 0.30000000000000004).
const round2 = (n) => Math.round(n * 100) / 100;

// Recorta una lista de tareas al máximo (el total real va aparte, en `totales`).
const capped = (list) => list.slice(0, MAX_TASKS);

// Reservas del mes natural que cuentan (CONFIRMED o COMPLETED): cantidad e ingresos, con
// agregaciones de Firestore (sin leer documentos y sin tope).
async function monthFigures(companyId, now) {
  const { from, to } = monthRange(now);
  const { count, total } = await bookingModel.summarizeByCompany(companyId, {
    statuses: BILLABLE,
    from,
    to,
  });
  return { reservasMes: count, ingresosMes: round2(total) };
}

// Lee los documentos de una empresa con tope: devuelve la lista y si había más de MAX_DOCS.
async function loadCapped(listByCompany, companyId) {
  const docs = await listByCompany(companyId, { limit: MAX_DOCS + 1 });
  return { docs: docs.slice(0, MAX_DOCS), truncated: docs.length > MAX_DOCS };
}

// Las próximas reservas vivas (CONFIRMED o PENDING_PAYMENT) de las salas propias, de la más cercana
// a la más lejana, con la sala y el cliente (nombre y email; nunca su id ni su teléfono).
async function upcomingBookings(companyId, now, roomsById) {
  const nowMs = now.getTime();
  const bookings = await bookingModel.listUpcomingByCompany(companyId, {
    statuses: ACTIVE,
    from: now,
    limit: UPCOMING_FETCH,
  });
  const next = bookings
    .filter((b) => b.companyId === companyId && roomsById.has(b.roomId) && isActiveFuture(b, nowMs))
    .slice(0, UPCOMING_LIMIT);
  const userIds = [...new Set(next.map((b) => b.userId).filter(Boolean))];
  const users = await Promise.all(userIds.map((id) => userModel.findById(id)));
  const usersById = new Map(userIds.map((id, i) => [id, users[i]]));
  return next.map((booking) => {
    const item = toItem(booking);
    return {
      id: item.id,
      codigo: item.codigo,
      fecha: item.fecha,
      inicio: item.inicio,
      fin: item.fin,
      importe: item.importe,
      estado: item.estado,
      sala: toSala(roomsById.get(booking.roomId)),
      cliente: toCliente(usersById.get(booking.userId)),
    };
  });
}

// Orden estable de las tareas: edificio, número de planta y código/nombre.
function byLocation(buildingName, level) {
  return (a, b) =>
    (buildingName.get(a.buildingId) ?? '').localeCompare(buildingName.get(b.buildingId) ?? '') ||
    (level.get(a.floorId ?? a.id) ?? 0) - (level.get(b.floorId ?? b.id) ?? 0) ||
    String(a.codigo ?? a.nombre ?? '').localeCompare(String(b.codigo ?? b.nombre ?? ''));
}

// Plantas sin publicar (con o sin mapa) y salas activas sin precio o sin fotos, con sus ids. Una
// sala sin precio y sin fotos sale en las dos listas (son dos tareas distintas); las salas de una
// planta sin publicar también cuentan, porque precio y fotos se preparan antes de publicar.
function pendingTasks(buildings, floors, activeRooms) {
  const buildingName = new Map(buildings.map((b) => [b.id, b.name ?? '']));
  const level = new Map(floors.map((f) => [f.id, f.level ?? 0]));
  const sort = byLocation(buildingName, level);
  const plantas = floors
    .filter((f) => f.status !== 'PUBLISHED')
    .map((f) => ({
      id: f.id,
      nombre: f.name,
      numero: f.level,
      buildingId: f.buildingId,
      edificio: buildingName.get(f.buildingId) ?? null,
      sinMapa: !Array.isArray(f.salas) || f.salas.length === 0,
    }))
    .sort(sort);
  const toTask = (r) => ({
    id: r.id,
    nombre: r.name,
    codigo: r.code,
    floorId: r.floorId,
    buildingId: r.buildingId,
  });
  const sinPrecio = activeRooms
    .filter((r) => roomEstado(r) === 'sin_precio')
    .map(toTask)
    .sort(sort);
  const sinFotos = activeRooms
    .filter((r) => !Array.isArray(r.photos) || r.photos.length === 0)
    .map(toTask)
    .sort(sort);
  return {
    plantasSinPublicar: capped(plantas),
    salasSinPrecio: capped(sinPrecio),
    salasSinFotos: capped(sinFotos),
    totales: {
      plantasSinPublicar: plantas.length,
      salasSinPrecio: sinPrecio.length,
      salasSinFotos: sinFotos.length,
    },
  };
}

// Resumen del panel de la empresa: `primerAcceso` (sin edificios), cifras (edificios, salas
// publicadas, reservas e ingresos del mes natural), próximas reservas y tareas pendientes. Todo se
// ignora si está eliminado (borrado lógico). Se leen como mucho 1000 edificios, plantas y salas de la
// empresa (`truncado: true` si hay más). `now` se puede inyectar para probar los bordes del mes.
export async function getSummary(companyId, { now = new Date() } = {}) {
  const [loadedBuildings, loadedFloors, loadedRooms] = await Promise.all([
    loadCapped(buildingModel.listByCompany, companyId),
    loadCapped(floorModel.listByCompany, companyId),
    loadCapped(roomModel.listByCompany, companyId),
  ]);
  const { docs: allBuildings } = loadedBuildings;
  const { docs: allFloors } = loadedFloors;
  const { docs: allRooms } = loadedRooms;
  const truncated = loadedBuildings.truncated || loadedFloors.truncated || loadedRooms.truncated;
  const buildings = allBuildings.filter(notDeleted);
  const buildingIds = new Set(buildings.map((b) => b.id));
  // Una planta o sala solo cuenta si su edificio (y su planta) siguen vivos.
  const floors = allFloors.filter((f) => notDeleted(f) && buildingIds.has(f.buildingId));
  const floorIds = new Set(floors.map((f) => f.id));
  const activeRooms = allRooms.filter(
    (r) => notDeleted(r) && r.status === 'ACTIVE' && floorIds.has(r.floorId),
  );
  const roomsById = new Map(allRooms.map((r) => [r.id, r]));
  const [month, proximasReservas] = await Promise.all([
    monthFigures(companyId, now),
    upcomingBookings(companyId, now, roomsById),
  ]);
  return {
    primerAcceso: buildings.length === 0,
    mes: monthRange(now).mes,
    cifras: {
      edificios: buildings.length,
      salasPublicadas: activeRooms.filter((r) => roomEstado(r) === 'publicada').length,
      ...month,
    },
    proximasReservas,
    tareas: pendingTasks(buildings, floors, activeRooms),
    ...(truncated && { truncado: true }),
  };
}
