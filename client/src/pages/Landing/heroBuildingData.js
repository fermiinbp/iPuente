// Plantas del edificio del hero (ejemplo, sin API). Misma forma que FLOORS de data.js, más lo que
// necesita la escena 3D: `rooms` es el estado de ejemplo de cada sala de la planta ('free', 'busy' u 'off').
// De arriba abajo; la planta baja es recepción y no se alquila.

const countFree = (rooms) => rooms.filter((state) => state === 'free').length;

const planta4 = ['free', 'free', 'free', 'busy', 'off', 'free'];
const planta3 = ['busy', 'free', 'off', 'free', 'free', 'busy'];
const planta2 = ['free', 'busy', 'free', 'off', 'free', 'busy'];
const planta1 = ['free', 'free', 'busy', 'free', 'busy', 'free'];
const plantaBaja = ['off', 'off', 'off', 'off', 'off', 'off'];

export const FLOORS_HERO = [
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
