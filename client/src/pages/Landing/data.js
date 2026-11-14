// Datos de ejemplo de la Landing (sin API). Los identificadores son de ejemplo: no existen en Firestore.

export const BUILDING = {
  id: 'puerta-sur', // ejemplo
  name: 'Edificio Puerta Sur',
  city: 'Sevilla',
};

// Plantas de arriba abajo. La planta baja es recepción y no se alquila.
export const FLOORS = [
  { id: 'planta-3', name: 'Planta 3', number: 3, free: 2, total: 6 },
  { id: 'planta-2', name: 'Planta 2', number: 2, free: 5, total: 12 },
  { id: 'planta-1', name: 'Planta 1', number: 1, free: 3, total: 8 },
  { id: 'planta-baja', name: 'Planta baja', number: 0, free: 0, total: 0, off: true },
];

export const DEFAULT_FLOOR_ID = 'planta-2';

export const ROOM_FILTERS = [
  'Todas',
  'Reuniones',
  'Eventos y charlas',
  'Formación',
  'Boxes privados',
];

export const FEATURED_ROOMS = [
  {
    id: 'black-room-i', // ejemplo
    name: 'Black Room I',
    type: 'Reuniones',
    place: 'Edificio Puerta Sur, Sevilla',
    people: 12,
    price: 25,
  },
  {
    id: 'sala-grande', // ejemplo
    name: 'Sala Grande',
    type: 'Eventos y charlas',
    place: 'Edificio Puerta Sur, Sevilla',
    people: 40, // ejemplo
    price: 60, // ejemplo
  },
  {
    id: 'zona-azul', // ejemplo
    name: 'Zona Azul',
    type: 'Formación',
    place: 'Edificio Puerta Sur, Sevilla',
    people: 20, // ejemplo
    price: 35, // ejemplo
  },
  {
    id: 'box22', // ejemplo
    name: 'Box22',
    type: 'Boxes privados',
    place: 'Edificio Puerta Sur, Sevilla',
    people: 4, // ejemplo
    price: 12, // ejemplo
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Explora el edificio',
    text: 'Pasa por las plantas y mira cuántas salas quedan libres en cada una.',
  },
  {
    number: '02',
    title: 'Elige tu sala en el plano',
    text: 'Cada sala muestra su precio, su capacidad y su equipamiento.',
  },
  {
    number: '03',
    title: 'Reserva y paga online',
    text: 'Eliges fecha y horas, pagas con tarjeta y recibes la confirmación por email.',
  },
];

export const COMPANY_STEPS = ['Sube tu plano', 'Revisa las salas', 'Publica'];
