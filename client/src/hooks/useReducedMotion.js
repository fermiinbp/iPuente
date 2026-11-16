// Indica si la persona ha pedido reducir el movimiento en su sistema (prefers-reduced-motion).
import { useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

function suscribirse(avisar) {
  const media = window.matchMedia(CONSULTA);
  media.addEventListener('change', avisar);
  return () => media.removeEventListener('change', avisar);
}

const leer = () => window.matchMedia(CONSULTA).matches;
const leerEnServidor = () => false;

export function useReducedMotion() {
  return useSyncExternalStore(suscribirse, leer, leerEnServidor);
}
