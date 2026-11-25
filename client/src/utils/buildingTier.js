// Nivel de la cabecera de la landing según el dispositivo. Pura, sin dependencias, probada con `node:test`.
//  - 'full': edificio 3D que gira solo, escenario fijado y estampas ligadas al scroll (escritorio).
//  - 'calm': 3D quieto, estampas ya colocadas y sin fijar (movimiento reducido).
//  - 'compact': 3D quieto (se gira con el dedo) y debajo la rejilla de estampas (móvil y tableta con WebGL).
//  - 'static': sin 3D; solo la lista de estampas (ahorro de datos o sin WebGL).
export function chooseTier({ webgl, reducedMotion, saveData, finePointer, wide }) {
  if (!webgl || saveData) return 'static';
  if (!finePointer || !wide) return 'compact';
  return reducedMotion ? 'calm' : 'full';
}
