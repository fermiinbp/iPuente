// Nivel de la cabecera de la landing para este dispositivo: 'full', 'calm' o 'static' (ver utils/buildingTier.js).
// Combina WebGL, movimiento reducido, ahorro de datos, puntero fino y ancho de 960 px.
import { chooseTier } from '@/utils/buildingTier.js';
import { hasWebGL } from '@/utils/webgl.js';
import { useMediaQuery } from './useMediaQuery.js';
import { useReducedMotion } from './useReducedMotion.js';

export function useBuildingTier() {
  const reducedMotion = useReducedMotion();
  const finePointer = useMediaQuery('(pointer: fine)');
  const wide = useMediaQuery('(min-width: 960px)');
  const saveData = typeof navigator !== 'undefined' && navigator.connection?.saveData === true;
  return chooseTier({ webgl: hasWebGL(), reducedMotion, saveData, finePointer, wide });
}
