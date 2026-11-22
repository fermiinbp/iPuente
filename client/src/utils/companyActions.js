// Acciones del admin sobre una empresa, compartidas por la lista (AdminCompanies) y el detalle (AdminCompanyDetail):
// textos de cada acción, si pide motivo, la llamada a la API, qué acciones tiene cada estado, el estado de la API
// traducido a StatusBadge y los mensajes de error. Las usa CompanyActionModal.
import { COMPANY_STATUS } from '@/config/constants.js';
import {
  approveCompany,
  reactivateCompany,
  rejectCompany,
  suspendCompany,
} from '@/services/adminService.js';

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 500;

// Estado de la API (español) → estado de StatusBadge.
export const BADGE_STATUS = {
  pendiente: COMPANY_STATUS.PENDING,
  aprobada: COMPANY_STATUS.VERIFIED,
  rechazada: COMPANY_STATUS.REJECTED,
  suspendida: COMPANY_STATUS.SUSPENDED,
};

export const ESTADOS = Object.keys(BADGE_STATUS);

// Cada acción: textos del modal, si pide motivo, la llamada a la API y el mensaje de éxito.
export const ACTIONS = {
  approve: {
    label: 'Aprobar',
    title: (nombre) => `¿Aprobar ${nombre}?`,
    text: 'Podrá entrar en su panel y publicar sus edificios.',
    confirmLabel: 'Aprobar',
    call: (company) => approveCompany(company.id, { version: company.version }),
    done: (nombre) => `${nombre} está aprobada.`,
  },
  reject: {
    label: 'Rechazar',
    title: (nombre) => `Rechazar ${nombre}`,
    text: 'La solicitud queda rechazada. La empresa podrá corregir sus datos y volver a enviarla.',
    confirmLabel: 'Rechazar',
    needsMotivo: true,
    call: (company, motivo) => rejectCompany(company.id, motivo, { version: company.version }),
    done: (nombre) => `${nombre} está rechazada.`,
  },
  suspend: {
    label: 'Suspender',
    title: (nombre) => `Suspender ${nombre}`,
    text: 'Sus edificios dejarán de verse en iPuente. Las reservas futuras no se cancelan.',
    confirmLabel: 'Suspender',
    needsMotivo: true,
    call: (company, motivo) => suspendCompany(company.id, motivo),
    done: (nombre) => `${nombre} está suspendida.`,
  },
  reactivate: {
    label: 'Reactivar',
    title: (nombre) => `¿Reactivar ${nombre}?`,
    text: 'Sus edificios publicados vuelven a verse en iPuente.',
    confirmLabel: 'Reactivar',
    call: (company) => reactivateCompany(company.id),
    done: (nombre) => `${nombre} está activa de nuevo.`,
  },
};

// Acciones posibles en cada estado (rechazada no tiene ninguna).
export const ACTIONS_BY_ESTADO = {
  pendiente: ['approve', 'reject'],
  aprobada: ['suspend'],
  suspendida: ['reactivate'],
};

export const actionsFor = (estado) => ACTIONS_BY_ESTADO[estado] ?? [];

// Mensaje de un error de la API. `refreshed`: qué se ha vuelto a cargar («la lista», «los datos»).
export function actionErrorMessage(error, refreshed = 'la lista') {
  if (error?.code === 'INVALID_TRANSITION') {
    return `Esta empresa ha cambiado de estado. Hemos actualizado ${refreshed}.`;
  }
  if (error?.code === 'NETWORK_ERROR') return 'No hay conexión. Inténtalo de nuevo.';
  return error?.message || 'No se ha podido completar la acción. Inténtalo de nuevo.';
}

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// Fecha ISO de la API → «17 nov 2026» (o «—»).
export function formatCompanyDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date).replace(/\./g, '');
}
