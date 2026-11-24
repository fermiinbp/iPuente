// Búsqueda de direcciones con Nominatim (OpenStreetMap). Es un servidor externo, no nuestra API, por eso no pasa
// por apiClient (como mapStyleService). No envía datos del usuario: solo el texto buscado, sin cabeceras propias.
// La política de uso de Nominatim pide como mucho 1 petición por segundo: el límite es de módulo.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1000;
const UNAVAILABLE =
  'El buscador de direcciones no responde. Puedes situar el edificio en el mapa o escribir las coordenadas.';

let lastRequestAt = 0;

function abortError() {
  return new DOMException('Búsqueda cancelada', 'AbortError');
}

// Espera `ms` (cancelable con signal).
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Devuelve [{ etiqueta, latitud, longitud }]. Un AbortError se relanza tal cual; el resto de fallos, en español.
export async function searchAddress(texto, { signal } = {}) {
  // Se reserva el turno antes de esperar, así varias llamadas seguidas se escalonan.
  const turn = Math.max(Date.now(), lastRequestAt + MIN_INTERVAL_MS);
  lastRequestAt = turn;
  const delay = turn - Date.now();
  try {
    if (delay > 0) await wait(delay, signal);
    else if (signal?.aborted) throw abortError();
  } catch (error) {
    // Una búsqueda cancelada antes de salir no gasta el turno.
    lastRequestAt = Math.min(lastRequestAt, Math.max(turn - MIN_INTERVAL_MS, 0));
    throw error;
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    countrycodes: 'es',
    'accept-language': 'es',
    limit: '5',
    q: texto,
  });
  let data;
  try {
    const response = await fetch(`${ENDPOINT}?${params}`, { signal });
    if (!response.ok) throw new Error(`Nominatim: ${response.status}`);
    data = await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error(UNAVAILABLE, { cause: error });
  }
  if (!Array.isArray(data)) throw new Error(UNAVAILABLE);

  return data
    .map((item) => ({
      etiqueta: String(item.display_name ?? ''),
      latitud: Number(item.lat),
      longitud: Number(item.lon),
    }))
    .filter(
      (item) => item.etiqueta && Number.isFinite(item.latitud) && Number.isFinite(item.longitud),
    );
}
