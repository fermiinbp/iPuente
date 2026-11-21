// Carga datos de demo a partir de scripts/data/: usuarios de prueba (Firebase Auth con sus claims y ficha en users), empresas (una aprobada y otra pendiente), edificio, plantas, salas, reservas (confirmadas y canceladas) y un bloqueo.
// Es idempotente: usa ids fijos y set con merge, así que ejecutarlo dos veces no duplica nada ni recrea usuarios.
// Necesita SEED_DEMO_PASSWORD (mín. 12 caracteres): es la contraseña de los usuarios demo nuevos.
// Seguridad: se niega con NODE_ENV=production, exige --yes (sin él solo informa y no escribe), solo crea
// el admin demo con --admin y nunca toca a un usuario que ya existía sin la marca demo.
// Uso: SEED_DEMO_PASSWORD='...' npm run seed -w server -- --yes [--admin]
import '../src/config/timezone.js';

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { now } from '../src/models/baseModel.js';
import * as blockModel from '../src/models/blockModel.js';
import * as bookingModel from '../src/models/bookingModel.js';
import * as buildingModel from '../src/models/buildingModel.js';
import * as companyModel from '../src/models/companyModel.js';
import * as companyTaxIdModel from '../src/models/companyTaxIdModel.js';
import * as floorModel from '../src/models/floorModel.js';
import * as occupancyModel from '../src/models/occupancyModel.js';
import * as roomModel from '../src/models/roomModel.js';
import * as userModel from '../src/models/userModel.js';
import { authClient } from '../src/services/authService.js';

const dataDir = new URL('./data/', import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));

export const DEMO_CLIENT_ID = 'demo-client';
export const DEMO_BLOCK_ID = 'demo-block-1';
export const MIN_PASSWORD_LENGTH = 12;
const OPENING_HOURS = { days: [1, 2, 3, 4, 5], start: '08:00', end: '20:00' };

// Franjas (hora de inicio y de fin) de las reservas de ejemplo: una por planta.
const DEMO_SLOTS = [
  [9, 11],
  [10, 13],
  [12, 14],
  [16, 18],
];

// Reservas canceladas de ejemplo (códigos fijos por debajo de 1000), una por cada quien cancela.
const CANCELLED_BOOKINGS = [
  { id: 'demo-booking-cancelled-1', code: 'IP-950', hours: [17, 19], by: 'CLIENT' },
  {
    id: 'demo-booking-cancelled-2',
    code: 'IP-951',
    hours: [19, 20],
    by: 'COMPANY',
    reason: 'Mantenimiento de la sala',
  },
];

const pad = (n) => String(n).padStart(2, '0');
const toDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const atHour = (day, hour) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);

// Hoy si es laborable; si no, el próximo lunes. Así el plano del día tiene reservas.
function nextWorkingDay(from) {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  return day;
}

const SEED_STATUS = { aprobada: 'APPROVED', rechazada: 'REJECTED' };

// Comprueba la contraseña antes de escribir nada.
function assertPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Falta SEED_DEMO_PASSWORD o tiene menos de ${MIN_PASSWORD_LENGTH} caracteres. Defínela al lanzar el seed.`,
    );
  }
}

// Usuario de Auth con ese email, o null si no existe.
async function findAuthUser(email) {
  try {
    return await authClient().getUserByEmail(email);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
    return null;
  }
}

// Claims del usuario demo: conserva los que ya tenga y añade rol, empresa y la marca demo.
function demoClaims(user, existing, companies) {
  const claims = { ...existing, role: user.rol, demo: true };
  if (user.companyId) {
    claims.companyId = user.companyId;
    claims.companyApproved = companies.find((c) => c.id === user.companyId)?.estado === 'aprobada';
  }
  return claims;
}

// Crea el usuario en Auth (con la marca demo) o reutiliza el demo que ya existía, y escribe su
// ficha en users. Devuelve el uid real y si se ha creado ahora.
async function seedUser(user, existing, companies, password) {
  let record = existing;
  const created = !record;
  if (created) {
    record = await authClient().createUser({
      uid: user.uid,
      email: user.email,
      password,
      displayName: `${user.nombre} ${user.apellidos}`,
      emailVerified: true,
    });
  }
  const claims = demoClaims(user, record.customClaims, companies);
  await authClient().setCustomUserClaims(record.uid, claims);
  await userModel.upsert(record.uid, {
    name: user.nombre,
    surname: user.apellidos,
    email: user.email,
    phone: user.telefono,
    role: user.rol,
    demo: true,
  });
  return { uid: record.uid, created };
}
async function seedCompany(company, ownerUid) {
  await companyModel.upsert(company.id, {
    name: company.nombre,
    legalName: company.razonSocial,
    taxId: company.cif,
    description: company.descripcion,
    logoUrl: null,
    email: company.email,
    phone: company.telefono,
    address: company.direccion,
    city: company.ciudad ?? 'Sevilla',
    termsAcceptedAt: now(),
    ownerUid,
    status: SEED_STATUS[company.estado] ?? 'PENDING',
    verified: company.estado === 'aprobada',
    demo: true,
  });
  // Índice de CIF únicos (idempotente), igual que el que crea el registro de empresas.
  await companyTaxIdModel.upsert(company.cif, { taxId: company.cif, companyId: company.id });
  await companyModel.setMember(company.id, ownerUid, 'OWNER');
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

// Reservas de la sala (confirmadas o canceladas) con los datos comunes.
function bookingData({ code, clientUid, companyId, room, day, hours, status }) {
  const [startHour, endHour] = hours;
  return {
    code,
    userId: clientUid,
    companyId,
    roomId: room.id,
    startDate: atHour(day, startHour),
    endDate: atHour(day, endHour),
    price: room.precioHora,
    pricePeriod: 'HOUR',
    totalAmount: room.precioHora * (endHour - startHour),
    status,
    paymentId: null,
    demo: true,
  };
}

// Una reserva confirmada en la primera sala reservable de cada planta, con sus horas en occupancy.
async function seedConfirmedBookings(rooms, companyId, clientUid, day) {
  const date = toDateString(day);
  const bookingIds = [];
  for (const [index, room] of rooms.entries()) {
    const hours = DEMO_SLOTS[index % DEMO_SLOTS.length];
    const bookingId = `demo-booking-${index + 1}`;
    // Código fijo por debajo de 1000: el contador `counters/bookings` no se toca y las reservas
    // reales siguen desde IP-1000 sin repetirlo.
    const code = `IP-${900 + index}`;
    await bookingModel.upsert(
      bookingId,
      bookingData({ code, clientUid, companyId, room, day, hours, status: 'CONFIRMED' }),
    );

    // Si el seed ya se ejecutó otro día, sus horas antiguas se borran antes de escribir las nuevas.
    await occupancyModel.removeByBooking(bookingId);
    for (let hour = hours[0]; hour < hours[1]; hour += 1) {
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
  return bookingIds;
}

// Reservas canceladas (por el cliente y por la empresa) en la primera sala: sin horas en occupancy.
async function seedCancelledBookings(room, companyId, clientUid, day, today) {
  for (const item of CANCELLED_BOOKINGS) {
    await bookingModel.upsert(item.id, {
      ...bookingData({
        code: item.code,
        clientUid,
        companyId,
        room,
        day,
        hours: item.hours,
        status: 'CANCELLED',
      }),
      cancelledAt: today,
      cancelledBy: item.by,
      cancelReason: item.reason ?? null,
    });
    await occupancyModel.removeByBooking(item.id);
  }
  return CANCELLED_BOOKINGS.map((item) => item.id);
}

// Un bloqueo de 14 a 16 h el siguiente día laborable, con su occupancy por hora (blockId).
async function seedBlock(room, companyId, day) {
  const blockDay = nextWorkingDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1));
  const date = toDateString(blockDay);
  await blockModel.upsert(DEMO_BLOCK_ID, {
    companyId,
    roomId: room.id,
    startDate: atHour(blockDay, 14),
    endDate: atHour(blockDay, 16),
    reason: 'Mantenimiento (demo)',
    demo: true,
  });
  // Si el seed ya se ejecutó otro día, las horas antiguas del bloqueo se borran antes.
  const old = await occupancyModel.listByBlock(DEMO_BLOCK_ID);
  await Promise.all(old.map((slot) => occupancyModel.remove(slot.id)));
  for (const hour of [14, 15]) {
    await occupancyModel.upsert(occupancyModel.slotId(room.id, date, hour), {
      companyId,
      roomId: room.id,
      date,
      hour,
      bookingId: null,
      blockId: DEMO_BLOCK_ID,
      demo: true,
    });
  }
  return date;
}

// Reservas, cancelaciones y bloqueo de demo sobre las salas reservables de cada planta.
async function seedBookings(rooms, floors, companyId, clientUid, today) {
  const day = nextWorkingDay(today);
  const bookable = floors
    .map((floor) => rooms.find((room) => room.floorId === floor.id && room.reservable))
    .filter(Boolean);

  const bookingIds = await seedConfirmedBookings(bookable, companyId, clientUid, day);
  const cancelledIds = await seedCancelledBookings(bookable[0], companyId, clientUid, day, today);
  const blockDate = await seedBlock(bookable.at(-1), companyId, day);
  return { date: toDateString(day), bookingIds, cancelledIds, blockDate };
}

// Mira en Auth qué usuarios existen. Uno que ya existía sin la marca demo no se toca: el admin se
// salta con aviso; si es el cliente o un dueño de empresa se aborta antes de escribir nada.
async function planUsers(users) {
  const existing = new Map();
  const skipped = [];
  for (const user of users) {
    const record = await findAuthUser(user.email);
    if (record && record.customClaims?.demo !== true) {
      if (user.rol !== 'ADMIN') {
        throw new Error(
          `${user.email} ya existe y no es una cuenta demo: el seed no la toca. Bórrala en Firebase Auth o usa otro email.`,
        );
      }
      skipped.push(user.email);
    } else {
      existing.set(user.email, record);
    }
  }
  return { existing, skipped };
}

export async function seed({
  today = new Date(),
  password = process.env.SEED_DEMO_PASSWORD,
  confirm = false,
  withAdmin = false,
} = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed no se puede ejecutar con NODE_ENV=production.');
  }
  assertPassword(password);
  const company = readJson('company.json');
  const pendingCompany = readJson('pending-company.json');
  const users = readJson('users.json').filter((user) => withAdmin || user.rol !== 'ADMIN');
  const building = readJson('building.json');
  const floors = building.plantas.map((planta) => readJson(planta.archivo));
  const rooms = readJson('rooms.json');
  const salasById = new Map(floors.flatMap((floor) => floor.salas.map((sala) => [sala.id, sala])));

  // Sin --yes no se escribe nada: solo se informa del destino.
  if (!confirm) {
    return {
      dryRun: true,
      projectId: process.env.FIREBASE_PROJECT_ID ?? '(sin definir)',
      users: users.map((user) => ({ email: user.email, role: user.rol })),
    };
  }

  const { existing, skipped } = await planUsers(users);
  // Usuarios primero: las empresas y las reservas usan sus uids reales (el de un usuario demo que
  // ya existía puede ser distinto del fijo).
  const uids = new Map();
  let usersCreated = 0;
  for (const user of users) {
    if (skipped.includes(user.email)) continue;
    const companies = [company, pendingCompany];
    const result = await seedUser(user, existing.get(user.email), companies, password);
    uids.set(user.uid, result.uid);
    if (result.created) usersCreated += 1;
  }
  const ownerOf = (companyId) => uids.get(users.find((u) => u.companyId === companyId).uid);

  await seedCompany(company, ownerOf(company.id));
  await seedCompany(pendingCompany, ownerOf(pendingCompany.id));
  await seedBuilding(building);
  for (const floor of floors) await seedFloor(floor, company.id);
  for (const room of rooms) await seedRoom(room, salasById.get(room.id), building);
  const bookings = await seedBookings(rooms, floors, company.id, uids.get(DEMO_CLIENT_ID), today);

  return {
    dryRun: false,
    company: company.id,
    pendingCompany: pendingCompany.id,
    building: building.id,
    floors: floors.length,
    rooms: rooms.length,
    users: users
      .filter((user) => !skipped.includes(user.email))
      .map((user) => ({ email: user.email, role: user.rol })),
    skipped,
    usersCreated,
    bookings: bookings.bookingIds.length,
    cancelledBookings: bookings.cancelledIds.length,
    bookingsDate: bookings.date,
    blockDate: bookings.blockDate,
  };
}

// Muestra qué haría el seed cuando falta --yes.
function printDryRun(summary) {
  console.log(`Destino: proyecto de Firebase "${summary.projectId}".`);
  console.log('Sin --yes no se escribe nada. Con --yes el seed:');
  console.log('  - crea (si no existen) estos usuarios demo en Auth y en users:');
  for (const user of summary.users) console.log(`    ${user.email} (${user.role})`);
  console.log('  - escribe empresas, edificio, plantas, salas, reservas y un bloqueo de demo.');
  console.log("Para continuar: SEED_DEMO_PASSWORD='...' npm run seed -w server -- --yes [--admin]");
}

// Muestra el resultado de un seed completado.
function printSummary(summary) {
  console.log('Seed completado:');
  console.log(`  ${summary.users.length} usuarios (${summary.usersCreated} nuevos):`);
  for (const user of summary.users) console.log(`    ${user.email} (${user.role})`);
  console.log('  Los nuevos usan la contraseña SEED_DEMO_PASSWORD; los existentes no se cambian.');
  for (const email of summary.skipped) {
    console.warn(`  AVISO: ${email} ya existe y no es demo: no se ha tocado.`);
  }
  console.log(`  empresas ${summary.company} (aprobada) y ${summary.pendingCompany} (pendiente)`);
  console.log(`  edificio ${summary.building}`);
  console.log(`  ${summary.floors} plantas y ${summary.rooms} salas`);
  console.log(`  ${summary.bookings} reservas confirmadas el ${summary.bookingsDate}`);
  console.log(`  ${summary.cancelledBookings} canceladas y un bloqueo el ${summary.blockDate}`);
}

// Solo se ejecuta al lanzarlo como script (no al importarlo desde los tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  seed({ confirm: args.includes('--yes'), withAdmin: args.includes('--admin') })
    .then((summary) => (summary.dryRun ? printDryRun(summary) : printSummary(summary)))
    .catch((err) => {
      console.error('Error al cargar el seed:', err.message);
      process.exit(1);
    });
}
