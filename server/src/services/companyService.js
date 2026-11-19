// Reglas de empresas: estado (PENDING, APPROVED, REJECTED) y su nombre en español, y consulta de la empresa propia.
import * as companyModel from '../models/companyModel.js';
import { HttpError } from '../utils/httpError.js';

export const COMPANY_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const STATUS_ES = {
  [COMPANY_STATUS.PENDING]: 'pendiente',
  [COMPANY_STATUS.APPROVED]: 'aprobada',
  [COMPANY_STATUS.REJECTED]: 'rechazada',
};

// Estado en español de una empresa. Si es antigua y no tiene status, se deriva de verified.
export function companyEstado(company) {
  if (STATUS_ES[company?.status]) return STATUS_ES[company.status];
  return company?.verified === true ? 'aprobada' : 'pendiente';
}

// Convierte un timestamp de Firestore (o fecha) a ISO; si no hay, undefined.
function toIso(value) {
  if (!value) return undefined;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Empresa del usuario autenticado, solo con los campos públicos para su dueño.
export async function getMyCompany(companyId) {
  const company = companyId ? await companyModel.findById(companyId) : null;
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
  return {
    id: company.id,
    name: company.name,
    taxId: company.taxId,
    contactName: company.contactName ?? null,
    phone: company.phone ?? null,
    email: company.email ?? null,
    estado: companyEstado(company),
    createdAt: toIso(company.createdAt),
  };
}
