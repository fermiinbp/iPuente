// Comprobaciones antes de publicar una planta (wireframe 13d). La API no tiene un endpoint de «validar»: se hacen aquí
// con las mismas reglas que la API y, aun así, la API vuelve a comprobarlas al publicar (MAP_REQUIRED y
// NO_BOOKABLE_ROOMS). Errores: bloquean. Avisos: no bloquean. Sin errores ni avisos se publica sin modal (wireframe 13d,
// nota 3); BILLING_NOTICE (la cuenta de cobro, simulada) solo se añade cuando el modal se abre por otra razón.
// Un nombre vacío ya es error (roomInfoErrors), así que no hay aviso de «sin nombre».
// `salas`: salas del mapa ({ id, codigo, nombre, tipo }). `dataOf(id)`: datos para el cliente de cada sala (en el
// formato del formulario, ver utils/roomData.js). Cada elemento: { roomId?, texto }.
import { hasClientData, roomInfoErrors, validateData } from './roomData.js';

export const BILLING_NOTICE =
  'Las salas de pago necesitan tu cuenta de cobros activa para publicarse; las salas gratis no.';

const label = (sala) => sala.codigo || sala.nombre || 'Sala sin código';

export function checkFloor({ salas, dataOf }) {
  const errores = [];
  const avisos = [];

  if (salas.length === 0) {
    errores.push({ texto: 'La planta no tiene salas.' });
    return { errores, avisos };
  }

  let bookable = false;
  for (const sala of salas) {
    const info = Object.values(roomInfoErrors(sala));
    if (info.length > 0) {
      errores.push({ roomId: sala.id, texto: `${label(sala)}: falta el código o el nombre.` });
    }
    if (!hasClientData(sala.tipo)) continue;

    const data = dataOf(sala.id);
    const dataErrors = Object.values(validateData(data));
    if (dataErrors.length > 0) {
      errores.push({
        roomId: sala.id,
        texto: `${label(sala)}: datos no válidos. ${dataErrors[0]}`,
      });
    }
    // Misma regla que la API: reservable y con precio (o gratis).
    const priced = data.gratis || (data.precioHora.trim() !== '' && dataErrors.length === 0);
    if (data.reservable && priced) bookable = true;

    if (data.capacidad.trim() === '') {
      avisos.push({ roomId: sala.id, texto: `${label(sala)} no tiene capacidad.` });
    }
    if (!data.fotos?.length) {
      avisos.push({ roomId: sala.id, texto: `${label(sala)} no tiene fotos.` });
    }
    if (!data.reservable) {
      avisos.push({
        roomId: sala.id,
        texto: `${label(sala)} no es reservable: los clientes no la podrán reservar.`,
      });
    }
  }

  if (!bookable) {
    errores.push({
      texto:
        'Ninguna sala se puede reservar: marca al menos una sala o box como reservable y ponle precio o márcala gratis.',
    });
  }
  return { errores, avisos };
}
