// Aprobación, rechazo y suspensión de empresas y listados globales del panel de admin.
import * as buildingModel from '../models/buildingModel.js';
import * as companyModel from '../models/companyModel.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as roomModel from '../models/roomModel.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
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
    fechaSolicitud: toIso(c.createdAt) ?? null,
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
    fechaSolicitud: toIso(company.createdAt) ?? null,
    revisadaEn: toIso(company.reviewedAt) ?? null,
    dueno: owner
      ? {
          nombre: [owner.name, owner.surname].filter(Boolean).join(' '),
          email: owner.email ?? null,
        }
      : null,
    edificios: buildings.map((b) => ({
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
async function transition(action, id, adminUid, motivo) {
  const rule = TRANSITIONS[action];
  return runTransaction(async (tx) => {
    const current = await companyModel.findById(id, { tx });
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'La empresa no existe');
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

// Vista tras una transición.
async function viewAfter(company) {
  return companyView(company);
}

export async function approveCompany(id, adminUid) {
  return viewAfter(await transition('approve', id, adminUid));
}

export async function rejectCompany(id, adminUid, motivo) {
  return viewAfter(await transition('reject', id, adminUid, motivo));
}

export async function reactivateCompany(id, adminUid) {
  return viewAfter(await transition('reactivate', id, adminUid));
}

// Suspende una empresa: sus edificios dejan de verse en la API pública (por su estado). Las reservas futuras
// no se tocan; la respuesta avisa de cuántas hay.
export async function suspendCompany(id, adminUid, motivo) {
  const company = await transition('suspend', id, adminUid, motivo);
  const view = await viewAfter(company);
  // La empresa ya está suspendida: si el aviso falla, se responde sin él en vez de dar error.
  try {
    const rooms = await roomModel.listByCompany(id);
    const reservasFuturas = await countFutureBookings(rooms.map((r) => r.id));
    const aviso = futureBookingsNotice(reservasFuturas, 'esta empresa');
    return { ...view, reservasFuturas, ...(aviso && { aviso }) };
  } catch (err) {
    console.error('No se pudo calcular el aviso de reservas futuras al suspender', err?.code);
    return view;
  }
}
