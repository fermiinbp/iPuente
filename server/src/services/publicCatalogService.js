// Visibilidad pública de edificios: el estado de la empresa (companies.status) es la única
// fuente de verdad. Un edificio es público si está PUBLISHED y su empresa está APPROVED.
import * as companyModel from '../models/companyModel.js';
import { isPublicBuilding } from '../utils/publicBuilding.js';
import { companyStatus } from './companyService.js';

// Estado de una empresa a partir de su documento (undefined si no existe).
const stateOf = (company) => (company ? companyStatus(company) : undefined);

// ¿El edificio es público? Solo lee la empresa si el edificio está publicado. Con { tx } la
// lee dentro de una transacción.
export async function isBuildingPublic(building, { tx } = {}) {
  if (building?.status !== 'PUBLISHED') return false;
  const company = building.companyId
    ? await companyModel.findById(building.companyId, { tx })
    : null;
  return isPublicBuilding(building, stateOf(company));
}

// De una lista de edificios, los públicos. Lee las empresas por lotes de 30 (ceil(E/30)
// consultas, E = empresas distintas de los edificios publicados).
export async function filterPublicBuildings(buildings) {
  const published = buildings.filter((b) => b?.status === 'PUBLISHED');
  const companies = await companyModel.findByIds(published.map((b) => b.companyId));
  const states = new Map(companies.map((c) => [c.id, companyStatus(c)]));
  return published.filter((b) => isPublicBuilding(b, states.get(b.companyId)));
}
