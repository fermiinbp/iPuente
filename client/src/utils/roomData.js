// Datos para el cliente de una sala (precio, personas, m², equipamiento, «reservable» y fotos) en los formularios de empresa
// (RoomPropertiesPanel). En el formulario los números van como texto; aquí se pasan de la API al formulario, se
// validan con las mismas reglas que la API y se calcula el PATCH con solo lo que ha cambiado.

// Tipos de sala del mapa. Sala y Box tienen datos para el cliente; las zonas comunes (y cocina y pasillo) no.
export const ROOM_TYPES = [
  { value: 'sala', label: 'Sala' },
  { value: 'box', label: 'Box' },
  { value: 'comun', label: 'Zona común' },
];
export const TYPE_LABELS = {
  sala: 'Sala',
  box: 'Box',
  comun: 'Zona común',
  cocina: 'Cocina',
  pasillo: 'Pasillo',
};
export const hasClientData = (tipo) => tipo === 'sala' || tipo === 'box';

// Errores del código y el nombre de una sala del mapa (la API los exige con 1–50 y 1–100 caracteres).
export const roomInfoErrors = (room) => ({
  ...(String(room.codigo ?? '').trim() === '' && { codigo: 'Escribe un código.' }),
  ...(String(room.nombre ?? '').trim() === '' && { nombre: 'Escribe un nombre.' }),
});

// Equipamiento que se ofrece (los valores que ya usan los datos de la API).
export const AMENITIES = [
  { value: 'wifi', label: 'Wifi' },
  { value: 'proyector', label: 'Proyector' },
  { value: 'pantalla', label: 'Pantalla' },
  { value: 'pizarra', label: 'Pizarra' },
  { value: 'videoconferencia', label: 'Videoconferencia' },
  { value: 'climatizacion', label: 'Climatización' },
  { value: 'enchufes', label: 'Enchufes' },
];

// Una sala recién dibujada: la API la crea sin precio y no reservable.
export const EMPTY_DATA = Object.freeze({
  precioHora: '',
  gratis: false,
  capacidad: '',
  m2: '',
  equipamiento: [],
  reservable: false,
  fotos: [],
});

const toText = (value) => (value === null || value === undefined ? '' : String(value));

// Sala de GET /company/rooms → valores del formulario.
export function dataFromApi(room) {
  return {
    precioHora: room.gratis ? '' : toText(room.precioHora),
    gratis: room.gratis === true,
    capacidad: toText(room.capacidad),
    m2: toText(room.m2),
    equipamiento: Array.isArray(room.equipamiento) ? room.equipamiento : [],
    reservable: room.reservable === true,
    fotos: Array.isArray(room.fotos) ? room.fotos : [],
  };
}

const number = (text) => Number(String(text).replace(',', '.'));
const sameList = (a, b) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
// Las fotos van en orden (la primera es la portada): cuenta también el orden.
const sameOrder = (a = [], b = []) => a.length === b.length && a.every((item, i) => item === b[i]);

// Errores por campo ({ campo: mensaje }) de los datos de una sala, comparados con los guardados (`base`): la API no
// deja vaciar un número que ya tenía valor.
export function validateData(data, base = EMPTY_DATA) {
  const errors = {};
  if (!data.gratis) {
    if (data.precioHora.trim() === '') {
      if (base.precioHora !== '') errors.precioHora = 'Pon un precio o marca «Gratis».';
      else if (data.reservable) {
        errors.precioHora = 'Para que sea reservable, pon un precio o marca «Gratis».';
      }
    } else {
      const price = number(data.precioHora);
      if (!Number.isFinite(price) || price <= 0 || price > 10000) {
        errors.precioHora = 'Escribe un precio mayor que 0 (máximo 10000 €).';
      }
    }
  }
  if (data.capacidad.trim() === '') {
    if (base.capacidad !== '') errors.capacidad = 'Indica cuántas personas caben.';
  } else {
    const people = number(data.capacidad);
    if (!Number.isInteger(people) || people < 1 || people > 1000) {
      errors.capacidad = 'Escribe un número entero entre 1 y 1000.';
    }
  }
  if (data.m2.trim() === '') {
    if (base.m2 !== '') errors.m2 = 'Indica los metros cuadrados.';
  } else {
    const area = number(data.m2);
    if (!Number.isFinite(area) || area <= 0 || area > 100000) {
      errors.m2 = 'Escribe un número mayor que 0.';
    }
  }
  return errors;
}

// Cuerpo del PATCH con lo que cambia de `base` a `data`, o null si no cambia nada. Una zona común no lleva datos
// para el cliente: solo se le quita «reservable» si lo tenía.
export function patchFor(base, data, tipo) {
  if (!hasClientData(tipo)) return base.reservable ? { reservable: false } : null;
  const body = {};
  if (data.gratis && !base.gratis) body.gratis = true;
  if (!data.gratis) {
    const price = data.precioHora.trim();
    if (price !== '' && (price !== base.precioHora || base.gratis)) body.precioHora = number(price);
    else if (price === '' && base.gratis) body.gratis = false;
  }
  if (data.capacidad.trim() !== '' && data.capacidad.trim() !== base.capacidad) {
    body.capacidad = number(data.capacidad);
  }
  if (data.m2.trim() !== '' && data.m2.trim() !== base.m2) body.m2 = number(data.m2);
  if (!sameList(data.equipamiento, base.equipamiento)) body.equipamiento = data.equipamiento;
  if (data.reservable !== base.reservable) body.reservable = data.reservable;
  if (!sameOrder(data.fotos, base.fotos)) body.fotos = data.fotos ?? [];
  return Object.keys(body).length > 0 ? body : null;
}

// Valores del formulario después de guardar con éxito (los números ya normalizados por la API se releen después).
export function savedData(data) {
  return {
    ...data,
    precioHora: data.gratis ? '' : data.precioHora.trim(),
    capacidad: data.capacidad.trim(),
    m2: data.m2.trim(),
  };
}
