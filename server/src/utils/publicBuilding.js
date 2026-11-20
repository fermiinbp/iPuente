// Visibilidad pública de un edificio: publicado y con su empresa sin suspender.

// ¿El edificio puede verse en la API pública? (status PUBLISHED y empresa no suspendida)
export function isPublicBuilding(building) {
  return building?.status === 'PUBLISHED' && !building.companySuspended;
}
