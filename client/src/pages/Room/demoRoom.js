// Salas de ejemplo para ver la ficha sin API: las destacadas de la landing y las de las plantas de ejemplo.
// Los identificadores son de ejemplo: no existen en Firestore.
import { BUILDING, FEATURED_ROOMS } from '@/pages/Landing/data.js';
import { FLOORS_HERO, roomsForFloor } from '@/pages/Landing/heroBuildingData.js';

const EDIFICIO = { id: BUILDING.id, nombre: BUILDING.name, direccion: '', ciudad: BUILDING.city };
// Horas libres de ejemplo: 10:00 y 11:00 ocupadas.
export const DEMO_FREE_HOURS = [8, 9, 12, 13, 14, 15, 16, 17, 18, 19];

export function demoRoom(id) {
  const featured = FEATURED_ROOMS.find((room) => room.id === id);
  if (featured) {
    return {
      id: featured.id,
      codigo: '',
      nombre: featured.name,
      tipo: featured.type,
      descripcion: 'Sala de ejemplo para ver cómo se muestra la ficha.',
      capacidad: featured.people,
      m2: null,
      precioHora: featured.price,
      equipamiento: ['pantalla', 'pizarra', 'wifi'],
      fotos: [],
      reservable: true,
      edificio: EDIFICIO,
      planta: null,
    };
  }
  for (const floor of FLOORS_HERO) {
    const room = roomsForFloor(floor).find((item) => item.id === id);
    if (!room) continue;
    return {
      id: room.id,
      codigo: room.id,
      nombre: room.name,
      tipo: room.tipo,
      descripcion: 'Sala de ejemplo para ver cómo se muestra la ficha.',
      capacidad: room.people,
      m2: room.area,
      precioHora: room.price,
      equipamiento: room.equipment,
      fotos: [],
      reservable: room.status !== 'off',
      edificio: EDIFICIO,
      planta: { id: floor.id, nombre: floor.name, nivel: floor.number },
    };
  }
  return null;
}
