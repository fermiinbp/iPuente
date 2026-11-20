// Visibilidad pública de un edificio (parte pura): publicado, no eliminado y con su empresa aprobada.

// ¿El edificio puede verse en la API pública? Recibe el estado de su empresa (PENDING,
// APPROVED, REJECTED o SUSPENDED, ya derivado con companyStatus); sin empresa, undefined.
export function isPublicBuilding(building, companyState) {
  return building?.status === 'PUBLISHED' && !building.deletedAt && companyState === 'APPROVED';
}
