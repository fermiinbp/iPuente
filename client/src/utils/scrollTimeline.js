// Funciones puras del progreso de scroll (0 a 1) de la cabecera de la landing. Sin dependencias, para poder
// probarlas con `node:test`. Todo lo que se mueve con el scroll (estampas, empuje del giro, apertura de las
// plantas y desplazamiento del fondo) sale de un único progreso `p` a través de estas funciones.

export const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const easeOut = (t) => 1 - (1 - t) ** 3;

// Pista alta con un hijo fijado (sticky): 0 mientras no se ha fijado, 1 cuando se suelta.
// `stickyTop` es la distancia a la que se fija respecto a la ventana.
export function pinProgress({ trackTop, trackHeight, pinHeight, stickyTop }) {
  const range = trackHeight - pinHeight;
  if (range <= 0) return 1;
  return clamp01((stickyTop - trackTop) / range);
}

// Sin pista fijada: 0 cuando el elemento asoma por abajo y 1 cuando su borde superior llega al 30 % de la ventana.
export function viewProgress({ top, viewport, reach = 0.7 }) {
  if (viewport <= 0) return 1;
  return clamp01((viewport - top) / (viewport * reach));
}

// Aparición de la estampa `index` de `total`: una detrás de otra, y la última termina justo al llegar a 1.
export function stampProgress(p, index, total) {
  return easeOut(clamp01(p * (total + 1) - index - 0.3));
}

// Índice de la estampa que se está colocando (o la última colocada). Sirve para marcar su planta.
export function stampIndexAt(p, total) {
  if (total <= 0) return -1;
  return Math.min(total - 1, Math.max(0, Math.floor(p * (total + 1) - 0.3)));
}

export const SPIN_KICK = 0.9; // radianes extra que el scroll suma al giro automático
export const OPEN_MAX = 1; // apertura máxima de las plantas (1 = separación completa)

export const spinKick = (p) => clamp01(p) * SPIN_KICK;
// Se abre durante el primer 70 % del recorrido y se queda abierto.
export const openAt = (p) => easeOut(clamp01(p / 0.7)) * OPEN_MAX;
export const backdropShift = (p, travel = 600) => clamp01(p) * travel;
