// Qué planta del hero se abre según el progreso de scroll (la usa HeroStory). Vive aparte para poder probarla.
import { FLOORS_HERO } from './heroBuildingData.js';

// La planta baja es recepción y no se alquila: el scroll no la abre.
const RENTABLES = FLOORS_HERO.filter((floor) => !floor.off);
// Tramo del progreso en el que se van abriendo las plantas: antes, el edificio está cerrado; después, se queda en la última.
const RANGES = { pin: [0.12, 0.9], view: [0.35, 0.8] };

// Planta que corresponde a un progreso de scroll ('' = edificio cerrado).
export function floorForProgress(progress, mode, floors = RENTABLES) {
  const [start, end] = RANGES[mode];
  if (progress < start || floors.length === 0) return '';
  const index = Math.floor(((progress - start) / (end - start)) * floors.length);
  return floors[Math.min(floors.length - 1, Math.max(0, index))].id;
}
