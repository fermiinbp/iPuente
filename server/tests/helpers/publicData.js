// Datos de prueba para los endpoints públicos: siembra el Firestore falso con edificios, plantas, salas, reservas y un bloqueo.
import app from '../../src/app.js';
import * as blockModel from '../../src/models/blockModel.js';
import * as bookingModel from '../../src/models/bookingModel.js';
import * as buildingModel from '../../src/models/buildingModel.js';
import * as floorModel from '../../src/models/floorModel.js';
import * as roomModel from '../../src/models/roomModel.js';

export const FECHA = '2026-06-15';
export const PRIVATE_WORDS = ['cliente-secreto', 'userId', 'email', 'bookingId'];

export async function listen() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

export async function getJson(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

// Comprueba que la respuesta no contiene nada que identifique a un cliente.
export function privateWordsIn(text) {
  return PRIVATE_WORDS.filter((word) => text.includes(word));
}

const building = (name, status) => ({
  companyId: 'c1',
  name,
  description: 'Descripción',
  address: 'Calle Ficticia 1',
  city: 'Sevilla',
  postalCode: '41001',
  country: 'España',
  latitude: 37.38,
  longitude: -5.98,
  floorCount: 2,
  status,
  demo: true,
});

const sala = (id, x) => ({
  id,
  codigo: id.toUpperCase(),
  nombre: `Sala ${id}`,
  tipo: 'sala',
  x,
  y: 0,
  w: 100,
  h: 100,
});

const floor = (buildingId, name, level, status, ids) => ({
  companyId: 'c1',
  buildingId,
  name,
  level,
  status,
  ancho: 1000,
  alto: 600,
  origen: 'manual',
  salas: ids.map((id, i) => sala(id, i * 120)),
});

const room = (floorId, buildingId, id, extra = {}) => ({
  companyId: 'c1',
  buildingId,
  floorId,
  name: `Sala ${id}`,
  code: id.toUpperCase(),
  type: 'sala',
  description: 'Sala de pruebas',
  surface: 40,
  capacity: 10,
  price: 25,
  pricePeriod: 'HOUR',
  amenities: ['wifi', 'pantalla'],
  photos: ['https://example.com/foto.jpg'],
  bookable: true,
  status: 'ACTIVE',
  ...extra,
});

const at = (h) => new Date(2026, 5, 15, h);

const booking = (roomId, status, start, end) => ({
  userId: 'cliente-secreto',
  companyId: 'c1',
  roomId,
  startDate: at(start),
  endDate: at(end),
  price: 25,
  pricePeriod: 'HOUR',
  totalAmount: 25 * (end - start),
  status,
});

// Sala por sala (15 de junio de 2026):
//  r-free: reserva CANCELLED 9-11 (libre)         r-busy: CONFIRMED 10-12 (ocupada)
//  r-cancel: solo CANCELLED 9-11 (libre)          r-block: bloqueo 14-16 (ocupada)
//  r-nobook: bookable false                       r-inactive: INACTIVE
//  r-ghost: en el mapa de f-0 pero sin documento  r-up: libre en f-1
export async function seedPublicData() {
  await buildingModel.upsert('b-pub', building('Edificio publicado', 'PUBLISHED'));
  await buildingModel.upsert('b-draft', building('Edificio borrador', 'DRAFT'));

  const ids0 = ['r-free', 'r-busy', 'r-cancel', 'r-block', 'r-nobook', 'r-inactive', 'r-ghost'];
  await floorModel.upsert('f-1', floor('b-pub', 'Planta uno', 1, 'PUBLISHED', ['r-up']));
  await floorModel.upsert('f-0', floor('b-pub', 'Planta baja', 0, 'PUBLISHED', ids0));
  await floorModel.upsert(
    'f-draft',
    floor('b-pub', 'Planta borrador', 2, 'DRAFT', ['r-draftfloor']),
  );
  await floorModel.upsert(
    'f-in-draft',
    floor('b-draft', 'Planta de edificio borrador', 0, 'PUBLISHED', ['r-in-draft']),
  );

  const f0 = (id, extra) => roomModel.upsert(id, room('f-0', 'b-pub', id, extra));
  await f0('r-free');
  await f0('r-busy');
  await f0('r-cancel');
  await f0('r-block');
  await f0('r-nobook', { bookable: false });
  await f0('r-inactive', { status: 'INACTIVE' });
  await roomModel.upsert('r-up', room('f-1', 'b-pub', 'r-up'));
  await roomModel.upsert('r-draftfloor', room('f-draft', 'b-pub', 'r-draftfloor'));
  await roomModel.upsert('r-in-draft', room('f-in-draft', 'b-draft', 'r-in-draft'));

  await bookingModel.upsert('bk-1', booking('r-busy', 'CONFIRMED', 10, 12));
  await bookingModel.upsert('bk-2', booking('r-cancel', 'CANCELLED', 9, 11));
  await bookingModel.upsert('bk-3', booking('r-free', 'CANCELLED', 9, 11));
  await blockModel.upsert('bl-1', {
    companyId: 'c1',
    roomId: 'r-block',
    startDate: at(14),
    endDate: at(16),
    reason: 'Mantenimiento',
  });
}

// Añade para el buscador (todo con companyId c1):
//  b-mal «Centro Málaga» (PUBLISHED, con foto), planta f-mal PUBLISHED con
//    r-mal-box (box, 2 pers., 10 €, wifi), r-mal-big (sala, 40 pers., 60 €, wifi+pantalla+proyector)
//    y r-mal-full (sala, 4 pers., 15 €, wifi, CONFIRMED el 15/06 de 8 a 20);
//  f-mal-draft (DRAFT) con r-mal-draft de 1 € que nunca debe contar;
//  b-empty (PUBLISHED, planta PUBLISHED) con solo una sala no reservable.
export async function seedSearchData() {
  await buildingModel.upsert('b-mal', {
    ...building('Centro Málaga', 'PUBLISHED'),
    city: 'Málaga',
    photos: ['https://example.com/malaga.jpg'],
  });
  await buildingModel.upsert('b-empty', {
    ...building('Edificio vacío', 'PUBLISHED'),
    city: 'Cádiz',
  });
  await floorModel.upsert('f-mal', floor('b-mal', 'Planta Málaga', 0, 'PUBLISHED', ['r-mal-box']));
  await floorModel.upsert(
    'f-mal-draft',
    floor('b-mal', 'Planta Málaga borrador', 1, 'DRAFT', ['r-mal-draft']),
  );
  await floorModel.upsert('f-empty', floor('b-empty', 'Planta vacía', 0, 'PUBLISHED', ['r-empty']));
  const mal = (id, extra) => roomModel.upsert(id, room('f-mal', 'b-mal', id, extra));
  await mal('r-mal-box', { type: 'box', capacity: 2, price: 10, amenities: ['wifi'], photos: [] });
  await mal('r-mal-big', {
    capacity: 40,
    price: 60,
    amenities: ['wifi', 'pantalla', 'proyector'],
  });
  await mal('r-mal-full', { capacity: 4, price: 15, amenities: ['wifi'] });
  await roomModel.upsert(
    'r-mal-draft',
    room('f-mal-draft', 'b-mal', 'r-mal-draft', { price: 1, capacity: 100 }),
  );
  await roomModel.upsert('r-empty', room('f-empty', 'b-empty', 'r-empty', { bookable: false }));
  await bookingModel.upsert('bk-mal', booking('r-mal-full', 'CONFIRMED', 8, 20));
}

// Añade a f-0 una sala reservable y activa pero sin precio (r-noprice), para probar que no cuenta.
export async function seedRoomWithoutPrice() {
  const f0 = await floorModel.findById('f-0');
  await floorModel.update('f-0', { salas: [...f0.salas, sala('r-noprice', 840)] });
  await roomModel.upsert('r-noprice', room('f-0', 'b-pub', 'r-noprice', { price: null }));
}
