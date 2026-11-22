// Propiedad de recursos: comprueba que un edificio, planta o sala pertenece a la empresa del usuario.
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { HttpError } from '../utils/httpError.js';
import { isDeleted } from '../utils/softDelete.js';

// Siempre el mismo 404 si no existe, está eliminado lógicamente (salvo includeDeleted), es de otra
// empresa (comparación estricta) o companyId está vacío: no se revela que el recurso existe.
export function assertOwnedBy(resource, companyId, { includeDeleted = false } = {}) {
  if (
    !resource ||
    (!includeDeleted && isDeleted(resource)) ||
    !companyId ||
    resource.companyId !== companyId
  ) {
    throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
  }
  return resource;
}

// Reserva (o su sala) de la empresa: si no existe o es ajena lanza el mismo 404 que una inexistente,
// para no revelar que la reserva existe.
export function assertBookingOwned(resource, companyId) {
  if (!resource || !companyId || resource.companyId !== companyId) {
    throw new HttpError(404, 'NOT_FOUND', 'La reserva no existe');
  }
  return resource;
}

// Edificio de la empresa o error 404 (ajeno, inexistente o eliminado lógicamente es un 404).
export async function getOwnedBuilding(id, companyId) {
  return assertOwnedBy(await buildingModel.findById(id), companyId);
}

// Planta de la empresa o error 404 (ajena, inexistente o eliminada lógicamente es un 404).
export async function getOwnedFloor(id, companyId) {
  return assertOwnedBy(await floorModel.findById(id), companyId);
}

// Sala de la empresa o error 404. includeDeleted deja ver una sala eliminada lógicamente
// (solo para consultar su historial de reservas).
export async function getOwnedRoom(id, companyId, options) {
  return assertOwnedBy(await roomModel.findById(id), companyId, options);
}
