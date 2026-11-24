// Nivel de la cabecera de la landing según el dispositivo. Pura, sin dependencias, probada con `node:test`.
//  - 'full': edificio 3D que gira solo, escenario fijado y estampas ligadas al scroll (escritorio).
//  - 'calm': 3D quieto, estampas ya colocadas y sin fijar (movimiento reducido).
//  - 'static': sin 3D; solo la lista de estampas (móvil, tableta, ahorro de datos o sin WebGL).
export function chooseTier({ webgl, reducedMotion, saveData, finePointer, wide }) {
  if (!webgl || saveData || !finePointer || !wide) return 'static';
  return reducedMotion ? 'calm' : 'full';
}
