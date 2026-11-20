// Propiedad de recursos: comprueba que un edificio, planta o sala pertenece a la empresa del usuario.
import * as buildingModel from '../models/buildingModel.js';
import * as floorModel from '../models/floorModel.js';
import * as roomModel from '../models/roomModel.js';
import { HttpError } from '../utils/httpError.js';

// 404 si no existe y 403 si es de otra empresa (comparación estricta; companyId vacío siempre 403).
export function assertOwnedBy(resource, companyId) {
  if (!resource) throw new HttpError(404, 'NOT_FOUND', 'No se encontró el recurso');
  if (!companyId || resource.companyId !== companyId) {
    throw new HttpError(403, 'FORBIDDEN', 'No tienes permiso sobre este recurso');
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

// Edificio de la empresa o error 404/403.
export async function getOwnedBuilding(id, companyId) {
  return assertOwnedBy(await buildingModel.findById(id), companyId);
}

// Planta de la empresa o error 404/403.
export async function getOwnedFloor(id, companyId) {
  return assertOwnedBy(await floorModel.findById(id), companyId);
}

// Sala de la empresa o error 404/403.
export async function getOwnedRoom(id, companyId) {
  return assertOwnedBy(await roomModel.findById(id), companyId);
}
