// Configuración del mapa «Alrededor». Las coordenadas son provisionales (Sevilla) hasta que el equipo confirme las reales.
// Las coordenadas van en orden [lng, lat], como GeoJSON y MapLibre.

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export const BUILDING = {
  name: 'iPuente', // provisional
  lat: 37.3885, // provisional
  lng: -5.989, // provisional
  height: 60, // metros de la extrusión: más alta que el entorno
  // Huella del edificio (anillo cerrado) de unos 50 × 35 m. Provisional.
  footprint: [
    [-5.98928, 37.38834],
    [-5.98872, 37.38834],
    [-5.98872, 37.38866],
    [-5.98928, 37.38866],
    [-5.98928, 37.38834],
  ],
};

export const VIEW = {
  zoom: 16,
  pitch: 55,
  pitchMobile: 40,
  bearing: -20,
  poiZoomMax: 16.5,
  flyMs: 1200,
};
