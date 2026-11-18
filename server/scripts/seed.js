// Carga datos de demo en Firestore (empresa, edificio, plantas, salas y unas reservas confirmadas) a partir de scripts/data/.
// Es idempotente: usa ids fijos y set con merge, así que ejecutarlo dos veces no duplica nada.
// Uso: npm run seed -w server
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { ROLES } from '../src/config/roles.js';
import * as bookingModel from '../src/models/bookingModel.js';
import * as buildingModel from '../src/models/buildingModel.js';
import * as companyModel from '../src/models/companyModel.js';
import * as floorModel from '../src/models/floorModel.js';
import * as occupancyModel from '../src/models/occupancyModel.js';
import * as roomModel from '../src/models/roomModel.js';
import * as userModel from '../src/models/userModel.js';

const dataDir = new URL('./data/', import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));

export const DEMO_CLIENT_ID = 'demo-client';
const OPENING_HOURS = { days: [1, 2, 3, 4, 5], start: '08:00', end: '20:00' };

// Franjas (hora de inicio y de fin) de las reservas de ejemplo: una por planta.
const DEMO_SLOTS = [
  [9, 11],
  [10, 13],
  [12, 14],
  [16, 18],
];

const pad = (n) => String(n).padStart(2, '0');
const toDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Hoy si es laborable; si no, el próximo lunes. Así el plano del día tiene reservas.
function nextWorkingDay(from) {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  return day;
}

async function seedCompany(company) {
  await companyModel.upsert(company.id, {
    name: company.nombre,
    legalName: company.razonSocial,
    taxId: company.cif,
    description: company.descripcion,
    logoUrl: null,
    email: company.email,
    phone: company.telefono,
    address: company.direccion,
    verified: company.estado === 'aprobada',
    demo: true,
  });
}

async function seedBuilding(building) {
  await buildingModel.upsert(building.id, {
    companyId: building.companyId,
    name: building.nombre,
    description: building.descripcion,
    address: building.direccion,
    city: building.ciudad,
    postalCode: building.codigoPostal,
    country: building.pais,
    latitude: building.latitud,
    longitude: building.longitud,
    floorCount: building.numPlantas,
    status: building.estado === 'publicado' ? 'PUBLISHED' : 'DRAFT',
    demo: true,
  });
}

async function seedFloor(floor, companyId) {
  await floorModel.upsert(floor.id, {
    companyId,
    buildingId: floor.buildingId,
    name: floor.nombre,
    level: floor.nivel,
    mapImageUrl: null,
    ancho: floor.ancho,
    alto: floor.alto,
    origen: floor.origen,
    salas: floor.salas,
    status: 'PUBLISHED',
    demo: true,
  });
}

async function seedRoom(room, sala, building) {
  await roomModel.upsert(room.id, {
    companyId: building.companyId,
    buildingId: building.id,
    floorId: room.floorId,
    name: room.nombre,
    code: sala.codigo,
    type: room.tipo,
    description: '',
    surface: room.m2,
    capacity: room.capacidad,
    price: room.precioHora,
    pricePeriod: 'HOUR',
    amenities: room.equipamiento,
    bookable: room.reservable,
    status: 'ACTIVE',
    openingHours: OPENING_HOURS,
    demo: true,
  });
}

// Una reserva confirmada en la primera sala reservable de cada planta, con sus horas en occupancy.
async function seedBookings(rooms, floors, companyId, today) {
  const day = nextWorkingDay(today);
  const date = toDateString(day);
  const bookableByFloor = floors
    .map((floor) => rooms.find((room) => room.floorId === floor.id && room.reservable))
    .filter(Boolean);

  const bookingIds = [];
  for (const [index, room] of bookableByFloor.entries()) {
    const [startHour, endHour] = DEMO_SLOTS[index % DEMO_SLOTS.length];
    const bookingId = `demo-booking-${index + 1}`;
    const hours = endHour - startHour;

    await bookingModel.upsert(bookingId, {
      userId: DEMO_CLIENT_ID,
      companyId,
      roomId: room.id,
      startDate: new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour),
      endDate: new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour),
      price: room.precioHora,
      pricePeriod: 'HOUR',
      totalAmount: room.precioHora * hours,
      status: 'CONFIRMED',
      paymentId: null,
      demo: true,
    });

    // Si el seed ya se ejecutó otro día, sus horas antiguas se borran antes de escribir las nuevas.
    await occupancyModel.removeByBooking(bookingId);
    for (let hour = startHour; hour < endHour; hour += 1) {
      await occupancyModel.upsert(occupancyModel.slotId(room.id, date, hour), {
        companyId,
        roomId: room.id,
        date,
        hour,
        bookingId,
        blockId: null,
        demo: true,
      });
    }
    bookingIds.push(bookingId);
  }
  return { date, bookingIds };
}

export async function seed({ today = new Date() } = {}) {
  const company = readJson('company.json');
  const building = readJson('building.json');
  const floors = building.plantas.map((planta) => readJson(planta.archivo));
  const rooms = readJson('rooms.json');
  const salasById = new Map(floors.flatMap((floor) => floor.salas.map((sala) => [sala.id, sala])));

  await seedCompany(company);
  await seedBuilding(building);
  for (const floor of floors) await seedFloor(floor, company.id);
  for (const room of rooms) await seedRoom(room, salasById.get(room.id), building);

  await userModel.upsert(DEMO_CLIENT_ID, {
    name: 'Cliente',
    surname: 'Demo',
    email: 'cliente.demo@example.com',
    phone: null,
    role: ROLES.CLIENT,
    demo: true,
  });
  const bookings = await seedBookings(rooms, floors, company.id, today);

  return {
    company: company.id,
    building: building.id,
    floors: floors.length,
    rooms: rooms.length,
    bookings: bookings.bookingIds.length,
    bookingsDate: bookings.date,
  };
}

// Solo se ejecuta al lanzarlo como script (no al importarlo desde los tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then((summary) => {
      console.log('Seed completado:');
      console.log(`  empresa ${summary.company} y edificio ${summary.building}`);
      console.log(`  ${summary.floors} plantas y ${summary.rooms} salas`);
      console.log(`  ${summary.bookings} reservas confirmadas el ${summary.bookingsDate}`);
    })
    .catch((err) => {
      console.error('Error al cargar el seed:', err.message);
      process.exit(1);
    });
}
