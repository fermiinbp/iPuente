// Datos de ejemplo de la Landing (sin API). Los identificadores son de ejemplo: no existen en Firestore.

export const BUILDING = {
  id: 'puerta-sur', // ejemplo
  name: 'Edificio Puerta Sur',
  city: 'Sevilla',
};

export const DEFAULT_FLOOR_ID = 'planta-2';

// Filtros de «Salas destacadas»: etiqueta → tipo de sala de la API (null = todas).
export const ROOM_FILTERS = [
  { label: 'Todas', tipo: null },
  { label: 'Salas', tipo: 'sala' },
  { label: 'Boxes', tipo: 'box' },
];

// Salas de ejemplo con la forma de getFeaturedRooms. Solo en desarrollo y si la API no responde:
// en producción nunca se enseñan datos inventados (sus ids no existen en Firestore).
export const DEMO_FEATURED_ROOMS = [
  { id: 'black-room-i', nombre: 'Black Room I', tipo: 'sala', capacidad: 12, precioHora: 25 },
  { id: 'sala-grande', nombre: 'Sala Grande', tipo: 'sala', capacidad: 40, precioHora: 60 },
  { id: 'zona-azul', nombre: 'Zona Azul', tipo: 'sala', capacidad: 20, precioHora: 35 },
  { id: 'box22', nombre: 'Box22', tipo: 'box', capacidad: 4, precioHora: 12 },
].map((sala) => ({ ...sala, edificio: 'Edificio Puerta Sur', ciudad: 'Sevilla', gratis: false }));

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
    title: 'Reserva por horas',
    text: 'Eliges fecha y horas y ves la reserva confirmada al momento en Mis reservas.',
  },
];

export const COMPANY_STEPS = ['Sube tu plano', 'Dibuja las salas', 'Publica'];
