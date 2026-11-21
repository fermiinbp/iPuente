// Aprobación, rechazo y suspensión de empresas y consultas globales (usuarios, reservas y resumen).
import * as bookingModel from '../models/bookingModel.js';
import * as buildingModel from '../models/buildingModel.js';
import * as companyModel from '../models/companyModel.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as roomModel from '../models/roomModel.js';
import * as userModel from '../models/userModel.js';
import { addDays, monthRange, resolveRange } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { notDeleted } from '../utils/softDelete.js';
import { normalizeText } from '../utils/text.js';
import { authClient } from './authService.js';
import { atHour, buildBookingDetail, toCancellation, toItem } from './bookingsService.js';
import {
  COMPANY_STATUS,
  companyEstado,
  companyMotivo,
  companyStatus,
  toIso,
} from './companyService.js';
import { countFutureBookings, futureBookingsNotice } from './futureBookingsService.js';

const { PENDING, APPROVED, REJECTED, SUSPENDED } = COMPANY_STATUS;

// Estados en español del filtro -> estado de Firestore.
const ESTADO_TO_STATUS = {
  pendiente: PENDING,
  aprobada: APPROVED,
  rechazada: REJECTED,
  suspendida: SUSPENDED,
};
export const ESTADOS = Object.keys(ESTADO_TO_STATUS);

// Transiciones permitidas: acción -> estado de origen y de destino.
const TRANSITIONS = {
  approve: { from: PENDING, to: APPROVED, texto: 'aprobar', requiere: 'pendiente' },
  reject: { from: PENDING, to: REJECTED, texto: 'rechazar', requiere: 'pendiente' },
  suspend: { from: APPROVED, to: SUSPENDED, texto: 'suspender', requiere: 'aprobada' },
  reactivate: { from: SUSPENDED, to: APPROVED, texto: 'reactivar', requiere: 'suspendida' },
};

// Fila del listado de empresas.
function listItem(c) {
  return {
    id: c.id,
    nombre: c.name,
    cif: c.taxId,
    email: c.email ?? null,
    estado: companyEstado(c),
    fechaSolicitud: toIso(c.resubmittedAt ?? c.createdAt) ?? null,
    version: toIso(c.updatedAt) ?? null,
    verificada: companyStatus(c) === APPROVED,
  };
}

// Empresas, de la más reciente a la más antigua, con filtro opcional por estado (en español).
export async function listCompanies({ estado } = {}) {
  const all = await companyModel.listAll();
  const items = all
    .map(listItem)
    .filter((c) => !estado || c.estado === estado)
    .sort((a, b) => (b.fechaSolicitud ?? '').localeCompare(a.fechaSolicitud ?? ''));
  return { empresas: items };
}

// Detalle de una empresa para el admin: datos, estado, motivo, dueño y edificios.
async function companyView(company) {
  const [owner, buildings] = await Promise.all([
    company.ownerUid ? userModel.findById(company.ownerUid) : null,
    buildingModel.listByCompany(company.id),
  ]);
  return {
    id: company.id,
    nombre: company.name,
    razonSocial: company.legalName ?? null,
    cif: company.taxId,
    email: company.email ?? null,
    telefono: company.phone ?? null,
    direccion: company.address ?? null,
    descripcion: company.description ?? null,
    contacto: company.contactName ?? null,
    estado: companyEstado(company),
    verificada: companyStatus(company) === APPROVED,
    motivo: companyMotivo(company),
    fechaSolicitud: toIso(company.resubmittedAt ?? company.createdAt) ?? null,
    version: toIso(company.updatedAt) ?? null,
    revisadaEn: toIso(company.reviewedAt) ?? null,
    dueno: owner
      ? {
          nombre: [owner.name, owner.surname].filter(Boolean).join(' '),
          email: owner.email ?? null,
        }
      : null,
    edificios: buildings.filter(notDeleted).map((b) => ({
      id: b.id,
      nombre: b.name,
      ciudad: b.city,
      publicado: b.status === 'PUBLISHED',
    })),
  };
}

// Devuelve la empresa o lanza 404.
async function getCompanyOr404(id) {
  const company = await companyModel.findById(id);
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'La empresa no existe');
  return company;
}

export async function getCompany(id) {
  return companyView(await getCompanyOr404(id));
}

// Campos que cambian en cada transición además de status, verified y la revisión.
function transitionFields(action, motivo, company) {
  if (action === 'reject') return { rejectionReason: motivo };
  if (action === 'suspend') return { suspensionReason: motivo };
  if (action === 'reactivate') {
    // El motivo de la suspensión pasa a lastSuspensionReason y se limpia suspensionReason.
    return { suspensionReason: null, lastSuspensionReason: company.suspensionReason ?? null };
  }
  return {};
}

// Cambia el estado de una empresa en una transacción (status, verified, reviewedAt, reviewedBy).
// La API pública lee ese estado, así que no hay que tocar sus edificios.
// Si llega `version` (ISO de updatedAt al abrir la empresa) y ya no coincide: 409 STALE_DATA.
async function transition(action, id, adminUid, motivo, version) {
  const rule = TRANSITIONS[action];
  return runTransaction(async (tx) => {
    const current = await companyModel.findById(id, { tx });
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'La empresa no existe');
    if (version !== undefined && (toIso(current.updatedAt) ?? null) !== version) {
      throw new HttpError(
        409,
        'STALE_DATA',
        'La empresa ha cambiado sus datos desde que la abriste. Vuelve a cargarla antes de decidir.',
      );
    }
    if (companyStatus(current) !== rule.from) {
      throw new HttpError(
        400,
        'INVALID_TRANSITION',
        `No se puede ${rule.texto} una empresa que no está ${rule.requiere}`,
      );
    }
    const data = {
      status: rule.to,
      verified: rule.to === APPROVED,
      reviewedAt: now(),
      reviewedBy: adminUid,
      ...transitionFields(action, motivo, current),
    };
    await companyModel.update(id, data, { tx });
    return { ...current, ...data, reviewedAt: new Date() };
  });
}

// Pone el claim companyApproved al dueño (conservando role y companyId) y, si se retira, revoca sus
// tokens. Reintenta una vez; devuelve el aviso para el admin si no se pudo o null si todo fue bien.
async function syncOwnerClaim(ownerUid, approved) {
  if (!ownerUid) return null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const auth = authClient();
      const user = await auth.getUser(ownerUid);
      await auth.setCustomUserClaims(ownerUid, { ...user.customClaims, companyApproved: approved });
      if (!approved) await auth.revokeRefreshTokens(ownerUid);
      return null;
    } catch (err) {
      console.error(`No se pudo actualizar el permiso de subida (intento ${attempt})`, err?.code);
    }
  }
  return 'El estado de la empresa ha cambiado, pero los permisos de subida de imágenes del dueño se actualizarán al reintentar la acción o al ejecutar sync-company-claims.';
}

// Vista tras una transición, con el aviso si fallaron los claims.
async function viewAfter(company, approved) {
  const view = await companyView(company);
  const aviso = await syncOwnerClaim(company.ownerUid, approved);
  return aviso ? { ...view, aviso } : view;
}

export async function approveCompany(id, adminUid, version) {
  return viewAfter(await transition('approve', id, adminUid, undefined, version), true);
}

export async function rejectCompany(id, adminUid, motivo, version) {
  return viewAfter(await transition('reject', id, adminUid, motivo, version), false);
}

export async function reactivateCompany(id, adminUid) {
  return viewAfter(await transition('reactivate', id, adminUid), true);
}

// Suspende una empresa: sus edificios dejan de verse en la API pública (por su estado). Las reservas futuras
// no se tocan; la respuesta avisa de cuántas hay.
export async function suspendCompany(id, adminUid, motivo) {
  const company = await transition('suspend', id, adminUid, motivo);
  const view = await viewAfter(company, false);
  // La empresa ya está suspendida: si el aviso falla, se responde sin él en vez de dar error.
  try {
    const rooms = await roomModel.listByCompany(id);
    const reservasFuturas = await countFutureBookings(rooms.map((r) => r.id));
    const futuras = futureBookingsNotice(reservasFuturas, 'esta empresa');
    const aviso = [futuras, view.aviso].filter(Boolean).join(' ');
    return { ...view, reservasFuturas, ...(aviso && { aviso }) };
  } catch (err) {
    console.error('No se pudo calcular el aviso de reservas futuras al suspender', err?.code);
    return view;
  }
}

// Tamaño fijo de página y topes de lectura de los listados.
export const PAGE_SIZE = 20;
const USERS_READ_LIMIT = 1000;
const BOOKINGS_READ_LIMIT = 500;

// Página `page` (desde 1) de una lista ya ordenada.
const paginate = (items, page) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

// Nombre completo de un usuario.
const fullName = (u) => [u.name, u.surname].filter(Boolean).join(' ');

// Empresa de cada usuario de la página: por users.companyId o, si no hay, por companies.ownerUid.
async function companiesOfUsers(users) {
  const byId = new Map();
  const ids = users.map((u) => u.companyId).filter(Boolean);
  for (const c of await companyModel.findByIds(ids)) byId.set(c.id, c);
  const byOwner = new Map();
  const ownerUids = users.filter((u) => !u.companyId && u.role === 'COMPANY').map((u) => u.id);
  for (const c of await companyModel.findByOwnerUids(ownerUids)) byOwner.set(c.ownerUid, c);
  return (user) => {
    const c = user.companyId ? byId.get(user.companyId) : byOwner.get(user.id);
    return c ? { id: c.id, nombre: c.name ?? null } : null;
  };
}

// Usuarios, del alta más reciente al más antiguo (orden de la consulta: el tope conserva los
// recientes), con filtro por rol (en inglés), búsqueda por
// nombre o email (sin tildes ni mayúsculas) y paginación. Sin teléfono.
export async function listUsers({ rol, q, page = 1, readLimit = USERS_READ_LIMIT } = {}) {
  const all = await userModel.listAll({ role: rol, limit: readLimit });
  const needle = normalizeText(q);
  const found = all
    .filter(
      (u) =>
        !needle ||
        normalizeText(fullName(u)).includes(needle) ||
        normalizeText(u.email).includes(needle),
    )
    .map((user) => ({ user, fechaAlta: toIso(user.createdAt) ?? null }));
  const pageItems = paginate(found, page);
  const empresaDe = await companiesOfUsers(pageItems.map((i) => i.user));
  return {
    usuarios: pageItems.map(({ user, fechaAlta }) => ({
      id: user.id,
      nombre: fullName(user) || null,
      email: user.email ?? null,
      rol: user.role ?? null,
      empresa: empresaDe(user),
      fechaAlta,
    })),
    total: found.length,
    page,
    limit: PAGE_SIZE,
    truncado: all.length >= readLimit,
  };
}

// Caché por id para no leer dos veces el mismo documento dentro de una petición.
function cached(read) {
  const map = new Map();
  return (id) => {
    if (!id) return Promise.resolve(null);
    if (!map.has(id)) map.set(id, read(id));
    return map.get(id);
  };
}

// Reservas de todas las empresas en el rango (por defecto hoy - 30 días y 90 días desde ahí; máximo
// 366 días y 500 resultados), de la más reciente a la más antigua. Pagina primero y solo resuelve
// sala, edificio, empresa y cliente de la página.
export async function listBookings({
  estado,
  desde,
  hasta,
  companyId,
  page = 1,
  readLimit = BOOKINGS_READ_LIMIT,
} = {}) {
  const range = resolveRange({ desde, hasta });
  const bookings = await bookingModel.listInRange({
    from: atHour(range.desde, 0),
    to: atHour(addDays(range.hasta, 1), 0),
    companyId,
    status: estado,
    limit: readLimit,
  });
  const pageItems = paginate(bookings, page);
  const room = cached((id) => roomModel.findById(id));
  const building = cached((id) => buildingModel.findById(id));
  const user = cached((id) => userModel.findById(id));
  const companies = new Map(
    (await companyModel.findByIds(pageItems.map((b) => b.companyId))).map((c) => [c.id, c]),
  );
  const reservas = await Promise.all(
    pageItems.map(async (b) => {
      const r = await room(b.roomId);
      const [edificio, cliente] = await Promise.all([building(r?.buildingId), user(b.userId)]);
      const empresa = companies.get(b.companyId);
      const { id, codigo, fecha, inicio, fin, importe, estado: status } = toItem(b);
      return {
        id,
        codigo,
        fecha,
        inicio,
        fin,
        importe,
        estado: status,
        sala: r ? { id: r.id, nombre: r.name ?? null } : null,
        edificio: edificio
          ? { id: edificio.id, nombre: edificio.name ?? null, ciudad: edificio.city ?? null }
          : null,
        empresa: empresa ? { id: empresa.id, nombre: empresa.name ?? null } : null,
        cliente: cliente
          ? { nombre: fullName(cliente) || null, email: cliente.email ?? null }
          : null,
        ...toCancellation(b),
      };
    }),
  );
  const truncado = bookings.length >= readLimit;
  // Si se cortó la lectura, las reservas más antiguas del rango pueden faltar: `desdeEfectivo` es la
  // fecha de la más antigua leída (desde ahí el listado es completo).
  return {
    reservas,
    total: bookings.length,
    page,
    limit: PAGE_SIZE,
    desde: range.desde,
    hasta: range.hasta,
    truncado,
    ...(truncado && { desdeEfectivo: toItem(bookings[bookings.length - 1]).fecha }),
  };
}

// Detalle de cualquier reserva con su empresa y el nombre y email del cliente (sin teléfono ni uid).
export async function getBooking(id) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
  const [detail, company, client] = await Promise.all([
    buildBookingDetail(booking),
    booking.companyId ? companyModel.findById(booking.companyId) : null,
    booking.userId ? userModel.findById(booking.userId) : null,
  ]);
  return {
    ...detail,
    empresa: company ? { id: company.id, nombre: company.name ?? null } : null,
    cliente: client ? { nombre: fullName(client) || null, email: client.email ?? null } : null,
  };
}

const BOOKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED'];
const USER_ROLES = ['CLIENT', 'COMPANY', 'ADMIN'];

// Resumen del panel con agregaciones count() de Firestore (no lee documentos): empresas por
// estado, usuarios por rol y reservas del mes actual (por fecha de inicio y en la zona horaria del
// servidor). Las empresas «pendientes» son el total menos las demás, de modo que las que no tienen
// `status` (anteriores a ese campo) cuentan como pendientes.
export async function getSummary() {
  const { from, to, mes } = monthRange();
  const monthFilters = [
    ['startDate', '>=', from],
    ['startDate', '<', to],
  ];
  const [totalEmpresas, aprobada, rechazada, suspendida, roles, estados] = await Promise.all([
    companyModel.countWhere(),
    companyModel.countWhere([['status', '==', APPROVED]]),
    companyModel.countWhere([['status', '==', REJECTED]]),
    companyModel.countWhere([['status', '==', SUSPENDED]]),
    Promise.all(USER_ROLES.map((r) => userModel.countWhere([['role', '==', r]]))),
    Promise.all(
      BOOKING_STATUSES.map((st) =>
        bookingModel.countWhere([['status', '==', st], ...monthFilters]),
      ),
    ),
  ]);
  const empresas = {
    pendiente: Math.max(0, totalEmpresas - aprobada - rechazada - suspendida),
    aprobada,
    rechazada,
    suspendida,
  };
  const usuarios = Object.fromEntries(USER_ROLES.map((r, i) => [r, roles[i]]));
  const porEstado = Object.fromEntries(BOOKING_STATUSES.map((st, i) => [st, estados[i]]));
  const total = estados.reduce((a, b) => a + b, 0);
  return { empresas, usuarios, reservasMes: { total, porEstado, mes } };
}
