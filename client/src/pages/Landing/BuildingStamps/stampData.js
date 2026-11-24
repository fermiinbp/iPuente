// Estampas de la cabecera de la landing: 6 salas de ejemplo en 3 plantas (2 por planta, de arriba abajo). Salen de las
// plantas de ejemplo del hero (`FLOORS_HERO` + `roomsForFloor`), así sus ids (`4.01`…) existen también en la ficha de
// sala de demostración. Cuando haya API, solo cambia el origen (`getFloor` de cada planta), no los componentes.
import { FLOORS_HERO, roomsForFloor } from '../heroBuildingData.js';

// [número de planta, índices de sus salas]. Mezcla de estados: 3 libres, 2 ocupadas y 1 que no se alquila.
export const STAMP_PICKS = [
  [4, [0, 3]],
  [3, [2, 1]],
  [2, [1, 4]],
];

export function stampsFromFloors(floors, picks = STAMP_PICKS) {
  const stamps = [];
  for (const [number, indexes] of picks) {
    const floor = floors.find((item) => item.number === number);
    if (!floor) continue;
    const rooms = roomsForFloor(floor);
    for (const index of indexes) {
      const room = rooms[index];
      if (!room) continue;
      stamps.push({
        id: room.id,
        floorId: floor.id,
        floorName: floor.name,
        name: room.name,
        status: room.status, // 'free' | 'occupied' | 'off'
        price: room.price,
        people: room.people,
      });
    }
  }
  return stamps;
}

export const HERO_STAMPS = stampsFromFloors(FLOORS_HERO);
// Plantas que llevan estampas (sin repetir), en el orden en que aparecen.
export const STAMP_FLOOR_IDS = [...new Set(HERO_STAMPS.map((stamp) => stamp.floorId))];
