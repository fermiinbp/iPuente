// Plantas del edificio del hero (ejemplo, sin API). Misma forma que FLOORS de data.js, más lo que
// necesita la escena 3D: `rooms` es el estado de ejemplo de cada sala de la planta ('free', 'busy' u 'off').
// De arriba abajo; la planta baja es recepción y no se alquila.
import { FLOOR_PLAN } from './floorPlanData.js';

const countFree = (rooms) => rooms.filter((state) => state === 'free').length;

const planta4 = ['free', 'free', 'free', 'busy', 'off', 'free'];
const planta3 = ['busy', 'free', 'off', 'free', 'free', 'busy'];
const planta2 = ['free', 'busy', 'free', 'off', 'free', 'busy'];
const planta1 = ['free', 'free', 'busy', 'free', 'busy', 'free'];
const plantaBaja = ['off', 'off', 'off', 'off', 'off', 'off'];

const planta6 = ['free', 'free', 'busy', 'free', 'free', 'free'];
const planta5 = ['busy', 'free', 'free', 'off', 'busy', 'free'];

export const FLOORS_HERO = [
  {
    id: 'planta-6',
    name: 'Planta 6',
    number: 6,
    free: countFree(planta6),
    total: 6,
    rooms: planta6,
  },
  {
    id: 'planta-5',
    name: 'Planta 5',
    number: 5,
    free: countFree(planta5),
    total: 6,
    rooms: planta5,
  },
  {
    id: 'planta-4',
    name: 'Planta 4',
    number: 4,
    free: countFree(planta4),
    total: 6,
    rooms: planta4,
  },
  {
    id: 'planta-3',
    name: 'Planta 3',
    number: 3,
    free: countFree(planta3),
    total: 6,
    rooms: planta3,
  },
  {
    id: 'planta-2',
    name: 'Planta 2',
    number: 2,
    free: countFree(planta2),
    total: 6,
    rooms: planta2,
  },
  {
    id: 'planta-1',
    name: 'Planta 1',
    number: 1,
    free: countFree(planta1),
    total: 6,
    rooms: planta1,
  },
  {
    id: 'planta-baja',
    name: 'Planta baja',
    number: 0,
    free: 0,
    total: 0,
    off: true,
    rooms: plantaBaja,
  },
];

// Historia del hero: planta, sala y franja que se enseñan solos (ejemplo, sin API).
export const HERO_STORY = {
  floorId: 'planta-2',
  roomId: '2.03',
  start: '10:00',
  end: '12:00',
  hours: 2,
};

// Salas de una planta para el plano del hero: la geometría, el precio y el equipamiento vienen de la
// Planta 2 de ejemplo (FLOOR_PLAN) y el estado de la planta (`busy` pasa a `occupied`).
export function roomsForFloor(floor) {
  return FLOOR_PLAN.rooms.map((room, index) => {
    const state = floor.rooms[index];
    return {
      ...room,
      id: `${floor.number}.0${index + 1}`,
      name: `Sala ${floor.number}.0${index + 1}`,
      status: state === 'busy' ? 'occupied' : state,
    };
  });
}
