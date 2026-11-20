// Recolorea el estilo base de OpenFreeMap (positron) con la paleta Bosque.
// Los colores salen de las variables de :root, no de hexadecimales escritos aquí.
import { getBaseMapStyle } from '@/services/mapStyleService.js';

const NOMBRES = [
  'bosque',
  'bosque-elevado',
  'bosque-profundo',
  'crema-suave',
  'linea-plano',
  'bronce',
  'bronce-claro',
  'lima',
];

export function readMapColors() {
  const estilo = getComputedStyle(document.documentElement);
  const colores = {};
  for (const nombre of NOMBRES) colores[nombre] = estilo.getPropertyValue(`--${nombre}`).trim();
  return colores;
}

// El estilo se pide al service (una sola descarga); aquí solo se recolorea.
export function loadBaseStyle() {
  return getBaseMapStyle();
}

function paint(capa, propiedades) {
  capa.paint = { ...capa.paint, ...propiedades };
}

// Pinta una capa de relleno o de línea con la propiedad que le corresponde (fill-color o line-color).
function tint(capa, color) {
  paint(capa, { [`${capa.type}-color`]: color });
}

export function recolorStyle(estilo, c) {
  for (const capa of estilo.layers) {
    const id = capa.id;
    const origen = capa['source-layer'];

    if (capa.type === 'background') {
      paint(capa, { 'background-color': c['bosque-profundo'] });
    } else if (id === 'building') {
      // Se sustituye por la capa 3D de NearbyMap.
      capa.layout = { ...capa.layout, visibility: 'none' };
    } else if (origen === 'boundary' || id.includes('shield') || id === 'airport') {
      // Sin fronteras, sin escudos de carretera y sin el POI del mapa base.
      capa.layout = { ...capa.layout, visibility: 'none' };
    } else if (capa.type === 'symbol') {
      paint(capa, {
        'text-color': c['crema-suave'],
        'text-halo-color': c['bosque-profundo'],
        'text-halo-width': 1.2,
      });
    } else if (id.startsWith('water') || origen === 'water' || origen === 'waterway') {
      tint(capa, c['bosque-elevado']);
    } else if (origen === 'park' || id === 'landcover_wood') {
      tint(capa, c.bosque);
    } else if (capa.type === 'fill' && (origen === 'landcover' || origen === 'landuse')) {
      tint(capa, c['bosque-profundo']);
    } else if (origen === 'aeroway') {
      tint(capa, capa.type === 'fill' ? c['bosque-elevado'] : c['linea-plano']);
    } else if (origen === 'transportation' && capa.type === 'line') {
      if (id.includes('casing')) {
        tint(capa, c['bosque-profundo']);
      } else if (id.includes('major') || id.includes('motorway')) {
        // Las calles principales, un poco más claras.
        paint(capa, { 'line-color': c['crema-suave'], 'line-opacity': 0.45 });
      } else {
        paint(capa, { 'line-color': c['linea-plano'], 'line-opacity': 1 });
      }
    }
  }
  return estilo;
}

export async function loadBosqueStyle() {
  return recolorStyle(await loadBaseStyle(), readMapColors());
}
