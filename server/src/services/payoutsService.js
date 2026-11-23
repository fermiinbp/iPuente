// Cobros de las empresas con Stripe Connect (modo prueba, Accounts v2): cada empresa tiene una cuenta
// conectada `recipient` (solo recibe transferencias) y los pagos de sus reservas le llegan con un
// destination charge. Aquí viven el alta (cuenta y enlace de Stripe), el estado real (siempre
// consultado a Stripe), el panel de Stripe y los movimientos. `assertPayoutsActive` es la regla única
// «¿esta empresa puede cobrar?»: la usan publicar planta, crear reserva y crear el checkout.
// Nunca llama a Stripe dentro de una transacción de Firestore, nunca devuelve el id `acct_` ni el
// detalle de un error de Stripe.
import { createHash } from 'node:crypto';

import { config } from '../config/config.js';
import { getStripe } from '../config/stripe.js';
import { now, runTransaction } from '../models/baseModel.js';
import * as bookingModel from '../models/bookingModel.js';
import * as companyModel from '../models/companyModel.js';
import * as paymentModel from '../models/paymentModel.js';
import * as roomModel from '../models/roomModel.js';
import { todayString } from '../utils/dates.js';
import { HttpError } from '../utils/httpError.js';
import { toDate } from './availabilityService.js';
import { COMPANY_STATUS, companyStatus, toIso } from './companyService.js';

// Estados de la cuenta de cobro que guarda y devuelve la API.
export const PAYOUT_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  ACTIVE: 'active',
  RESTRICTED: 'restricted',
});

// Movimientos: 20 por página y hasta 500 leídos.
export const MOVEMENTS_PAGE_SIZE = 20;
const MOVEMENTS_READ_LIMIT = 500;

// Campos que se piden a Stripe al leer una cuenta.
const ACCOUNT_INCLUDE = ['configuration.recipient', 'requirements'];

const unavailable = () =>
  new HttpError(503, 'PAYMENTS_UNAVAILABLE', 'Los pagos no están disponibles en este momento');

// Cliente de Stripe o 503 si no está configurado.
function stripeOrThrow() {
  const stripe = getStripe();
  if (!stripe) throw unavailable();
  return stripe;
}

// Llama a Stripe y convierte cualquier fallo en 502 (409 PAYOUTS_BUSY si la clave de idempotencia
// está en uso) sin filtrar su detalle: solo se registra el tipo.
async function callStripe(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err?.code === 'idempotency_key_in_use') {
      throw new HttpError(
        409,
        'PAYOUTS_BUSY',
        'Ya se está preparando tu cuenta de cobros; inténtalo de nuevo en unos segundos',
      );
    }
    console.error('Error de Stripe (cobros):', err?.type ?? err?.name ?? 'desconocido');
    throw new HttpError(
      502,
      'PAYMENTS_ERROR',
      'No se ha podido conectar con el sistema de pago. Inténtalo de nuevo',
    );
  }
}

// Origen de la web (sin barra final) para las URL de vuelta; 503 si no está configurado.
function webOrigin() {
  const origin = config.appUrl?.replace(/\/+$/, '');
  if (!origin) throw unavailable();
  return origin;
}

// Estado de una cuenta a partir de lo que devuelve Stripe: solo `active` si la capacidad de recibir
// transferencias lo está. Rechazada o restringida = restricted; el resto (o sin dato) = pending.
export function statusFromAccount(account) {
  if (account?.closed) return PAYOUT_STATUS.RESTRICTED;
  const status =
    account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  if (status === 'active') return PAYOUT_STATUS.ACTIVE;
  if (status === 'restricted' || status === 'rejected') return PAYOUT_STATUS.RESTRICTED;
  return PAYOUT_STATUS.PENDING;
}

// true si Stripe espera algo de la empresa (alguna entrada de requisitos pendiente de ella).
function hasUserRequirements(account) {
  const entries = account?.requirements?.entries;
  return Array.isArray(entries) && entries.some((e) => e?.awaiting_action_from === 'user');
}

// Lee la cuenta en Stripe y devuelve { estado, requisitosPendientes }.
async function fetchAccount(stripe, accountId) {
  const account = await callStripe(() =>
    stripe.v2.core.accounts.retrieve(accountId, { include: ACCOUNT_INCLUDE }),
  );
  return { estado: statusFromAccount(account), requisitosPendientes: hasUserRequirements(account) };
}

// Guarda el estado y la hora de comprobación. Con `bestEffort` un fallo de Firestore no se propaga.
async function saveStatus(companyId, estado, { bestEffort = false } = {}) {
  try {
    await companyModel.update(companyId, {
      stripeAccountStatus: estado,
      stripeStatusCheckedAt: now(),
    });
  } catch (err) {
    if (!bestEffort) throw err;
    console.error('No se pudo guardar el estado de cobros:', err?.name ?? 'desconocido');
  }
}

// Empresa propia o 404.
async function getCompanyOr404(companyId) {
  const company = companyId ? await companyModel.findById(companyId) : null;
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
  return company;
}

// 403 si la empresa no está aprobada (las rutas ya lo comprueban; se repite por si cambió).
function assertApproved(company) {
  if (companyStatus(company) !== COMPANY_STATUS.APPROVED) {
    throw new HttpError(403, 'COMPANY_NOT_APPROVED', 'Tu empresa no está aprobada');
  }
}

const requiredError = (forCompany) =>
  new HttpError(
    409,
    'PAYOUTS_REQUIRED',
    forCompany
      ? 'Conecta tu cuenta de cobros con Stripe para publicar salas de pago'
      : 'La empresa de esta sala no puede cobrar online ahora mismo, así que no se puede reservar ni pagar',
  );

// Comprueba que la empresa puede cobrar: tiene cuenta y Stripe dice AHORA que está activa (no se fía
// del estado guardado). Sin cuenta o no activa: 409 PAYOUTS_REQUIRED; Stripe no responde: 503
// PAYMENTS_UNAVAILABLE (falla cerrado). Devuelve el id de la cuenta conectada.
// `forCompany` solo cambia el texto del error (lo ve la empresa o el cliente).
export async function assertPayoutsActive(company, { forCompany = false } = {}) {
  const accountId = company?.stripeAccountId;
  if (!accountId) throw requiredError(forCompany);
  const stripe = stripeOrThrow();
  let account;
  try {
    account = await stripe.v2.core.accounts.retrieve(accountId, { include: ACCOUNT_INCLUDE });
  } catch (err) {
    console.error('Error de Stripe (cuenta de cobros):', err?.type ?? err?.name ?? 'desconocido');
    throw unavailable();
  }
  const estado = statusFromAccount(account);
  if (estado !== company.stripeAccountStatus) {
    await saveStatus(company.id, estado, { bestEffort: true });
  }
  if (estado !== PAYOUT_STATUS.ACTIVE) throw requiredError(forCompany);
  return accountId;
}

// Lee la empresa y comprueba que está aprobada y puede cobrar. Devuelve el id de la cuenta de destino.
// Una empresa que no está aprobada (suspendida, etc.) da 409 PAYOUTS_REQUIRED.
export async function assertCompanyCanCharge(companyId, { forCompany = false } = {}) {
  const company = companyId ? await companyModel.findById(companyId) : null;
  if (!company || companyStatus(company) !== COMPANY_STATUS.APPROVED) {
    throw requiredError(forCompany);
  }
  return assertPayoutsActive(company, { forCompany });
}

// Estado de cobros de la empresa propia, consultado a Stripe y guardado. Si Stripe falla devuelve el
// último estado guardado (sin darlo por activo si no lo estaba) con `desactualizado` y `aviso`.
// Devuelve { conectada, estado, requisitosPendientes, comprobadoEn, desactualizado?, aviso? }.
export async function getPayouts(companyId) {
  const company = await getCompanyOr404(companyId);
  if (!company.stripeAccountId) {
    return {
      conectada: false,
      estado: PAYOUT_STATUS.NONE,
      requisitosPendientes: false,
      comprobadoEn: null,
    };
  }
  const stripe = getStripe();
  try {
    if (!stripe) throw new Error('sin Stripe');
    const { estado, requisitosPendientes } = await fetchAccount(stripe, company.stripeAccountId);
    await saveStatus(companyId, estado);
    return {
      conectada: true,
      estado,
      requisitosPendientes,
      comprobadoEn: new Date().toISOString(),
    };
  } catch {
    const estado = company.stripeAccountStatus ?? PAYOUT_STATUS.PENDING;
    return {
      conectada: true,
      estado,
      requisitosPendientes: estado !== PAYOUT_STATUS.ACTIVE,
      comprobadoEn: toIso(company.stripeStatusCheckedAt) ?? null,
      desactualizado: true,
      aviso: 'No se ha podido consultar a Stripe; te mostramos el último estado conocido',
    };
  }
}

// Datos de la cuenta conectada de una empresa (Accounts v2, solo recibe transferencias).
function accountParams(company) {
  return {
    display_name: company.name,
    metadata: { companyId: company.id },
    ...(company.email && { contact_email: company.email }),
    dashboard: 'express',
    identity: { country: 'es', entity_type: 'company' },
    defaults: {
      currency: 'eur',
      responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
    include: ['configuration.recipient', 'requirements', 'identity'],
  };
}

// Guarda el id de cuenta en la empresa solo si no tenía ninguno (transacción) y devuelve el que
// queda guardado: dos peticiones simultáneas terminan con la misma cuenta.
async function storeAccountId(companyId, accountId) {
  return runTransaction(async (tx) => {
    const current = await companyModel.findById(companyId, { tx });
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'No se encontró tu empresa');
    if (current.stripeAccountId) return current.stripeAccountId;
    await companyModel.update(
      companyId,
      {
        stripeAccountId: accountId,
        stripeAccountStatus: PAYOUT_STATUS.PENDING,
        stripeStatusCheckedAt: now(),
      },
      { tx },
    );
    return accountId;
  });
}

// Crea la cuenta conectada con una clave de idempotencia estable por empresa y datos (un doble clic o dos
// peticiones a la vez reciben la misma cuenta; la que llega con la clave en uso recibe 409
// PAYOUTS_BUSY) y la guarda sin pisar una existente.
async function createAccount(stripe, company) {
  const params = accountParams(company);
  // La clave lleva un hash de los parámetros: con los mismos datos es estable (sin duplicados) y si
  // cambian (nombre o email) no choca con la clave anterior guardada 24 h por Stripe.
  const hash = createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 12);
  const created = await callStripe(() =>
    stripe.v2.core.accounts.create(params, {
      idempotencyKey: `connect-account:${company.id}:${hash}`,
    }),
  );
  return storeAccountId(company.id, created.id);
}

// Enlace de alta (onboarding) de Stripe para una cuenta; las URL de vuelta salen solo de APP_URL.
async function createOnboardingLink(stripe, accountId) {
  const base = `${webOrigin()}/company/settings?tab=cobros`;
  const link = await callStripe(() =>
    stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: `${base}&stripe=refrescar`,
          return_url: `${base}&stripe=retorno`,
        },
      },
    }),
  );
  return link.url;
}

// Inicia o continúa el alta de cobros: crea la cuenta si no existe (sin duplicados), y devuelve el
// enlace de Stripe. 409 PAYOUTS_ALREADY_ACTIVE si ya puede cobrar. Devuelve { url }.
export async function startOnboarding(companyId) {
  const stripe = stripeOrThrow();
  const company = await getCompanyOr404(companyId);
  assertApproved(company);
  let accountId = company.stripeAccountId;
  if (accountId) {
    const { estado } = await fetchAccount(stripe, accountId);
    await saveStatus(companyId, estado);
    if (estado === PAYOUT_STATUS.ACTIVE) {
      throw new HttpError(409, 'PAYOUTS_ALREADY_ACTIVE', 'Tu cuenta de cobros ya está activa');
    }
  } else {
    accountId = await createAccount(stripe, company);
  }
  return { url: await createOnboardingLink(stripe, accountId) };
}

// Enlace al panel de Stripe de la empresa. 409 PAYOUTS_REQUIRED si aún no tiene cuenta. { url }.
export async function createDashboardLink(companyId) {
  const stripe = stripeOrThrow();
  const company = await getCompanyOr404(companyId);
  if (!company.stripeAccountId) throw requiredError(true);
  const link = await callStripe(() => stripe.accounts.createLoginLink(company.stripeAccountId));
  return { url: link.url };
}

// Id opaco de un movimiento: no es el id de la sesión de Stripe (un hash de él).
function movementId(paymentId) {
  return `mov_${createHash('sha256').update(String(paymentId)).digest('hex').slice(0, 20)}`;
}

// Movimientos (pagos) de la empresa, los más recientes primero, 20 por página y hasta 500 leídos.
// Solo pagos con su companyId. Sin email ni uid del cliente ni ids de Stripe.
export async function listMovements(companyId, { page = 1 } = {}) {
  const payments = await paymentModel.listByCompany(companyId, { limit: MOVEMENTS_READ_LIMIT });
  const start = (page - 1) * MOVEMENTS_PAGE_SIZE;
  const items = payments.slice(start, start + MOVEMENTS_PAGE_SIZE);
  const bookings = await Promise.all(items.map((p) => bookingModel.findById(p.bookingId)));
  const roomIds = [...new Set(bookings.map((b) => b?.roomId).filter(Boolean))];
  const rooms = new Map(
    (await Promise.all(roomIds.map((id) => roomModel.findById(id)))).map((r, i) => [roomIds[i], r]),
  );
  return {
    movimientos: items.map((p, i) => {
      const booking = bookings[i];
      return {
        id: movementId(p.id),
        codigoReserva: booking?.code ?? null,
        sala: booking ? (rooms.get(booking.roomId)?.name ?? null) : null,
        fechaReserva: booking?.startDate ? todayString(toDate(booking.startDate)) : null,
        importe: p.amount ?? null,
        moneda: p.currency ?? null,
        estado: p.status,
        reembolsoPendiente: p.refundPending === true,
        fecha: toIso(p.createdAt) ?? null,
      };
    }),
    total: payments.length,
    page,
    limit: MOVEMENTS_PAGE_SIZE,
    truncado: payments.length >= MOVEMENTS_READ_LIMIT,
  };
}
