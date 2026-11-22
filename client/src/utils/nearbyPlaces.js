// Edificio y lugares cercanos del mapa «Alrededor» con las coordenadas reales de un edificio.
// Las coordenadas van en orden [lng, lat], como GeoJSON y MapLibre.
import { BUILDING } from '../config/nearby.js';

// Medio ancho y medio fondo de la huella provisional, en grados: la huella real mide igual y se centra en el edificio.
const HALF_LNG = (BUILDING.footprint[1][0] - BUILDING.footprint[0][0]) / 2;
const HALF_LAT = (BUILDING.footprint[2][1] - BUILDING.footprint[1][1]) / 2;

const isCoord = (value) => typeof value === 'number' && Number.isFinite(value);

// Edificio listo para el mapa a partir de lo que devuelve la API (`nombre`, `latitud`, `longitud`).
// Sin coordenadas válidas devuelve null y el mapa usa las provisionales de config/nearby.js.
export function buildingAt({ nombre, latitud, longitud } = {}) {
  if (!isCoord(latitud) || !isCoord(longitud)) return null;
  return {
    name: nombre || BUILDING.name,
    lat: latitud,
    lng: longitud,
    height: BUILDING.height,
    footprint: [
      [longitud - HALF_LNG, latitud - HALF_LAT],
      [longitud + HALF_LNG, latitud - HALF_LAT],
      [longitud + HALF_LNG, latitud + HALF_LAT],
      [longitud - HALF_LNG, latitud + HALF_LAT],
      [longitud - HALF_LNG, latitud - HALF_LAT],
    ],
  };
}

// Los lugares de `poi.json` son de ejemplo y están medidos desde el edificio provisional: se desplazan en bloque
// (lugares y rutas) para que cada ruta siga saliendo del edificio y mantenga su recorrido relativo.
export function shiftPlaces(pois, building) {
  const dLng = building.lng - BUILDING.lng;
  const dLat = building.lat - BUILDING.lat;
  return pois.map((poi) => ({
    ...poi,
    lat: poi.lat + dLat,
    lng: poi.lng + dLng,
    ruta: poi.ruta.map(([lng, lat]) => [lng + dLng, lat + dLat]),
  }));
}
