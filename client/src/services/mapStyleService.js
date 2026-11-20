// Descarga el estilo base del mapa (OpenFreeMap, positron). Es una petición a un servidor de mapas externo,
// no a nuestra API, por eso no pasa por apiClient. Los componentes no llaman a fetch: piden el estilo aquí.
import { MAP_STYLE_URL } from '@/config/nearby.js';

let cached;

// El JSON se descarga una sola vez; cada llamada recibe una copia para poder modificarla.
export async function getBaseMapStyle() {
  cached ??= fetch(MAP_STYLE_URL).then((response) => {
    if (!response.ok) throw new Error(`Estilo del mapa: ${response.status}`);
    return response.json();
  });
  const style = await cached.catch((error) => {
    cached = undefined;
    throw error;
  });
  return structuredClone(style);
}
