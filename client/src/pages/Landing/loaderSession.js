// Cuándo se muestra la pantalla de carga de la Landing y cuánto tarda en abrirse.
// Vive aparte para que el hero pueda esperar a que termine antes de hacer su entrada.
// Tiempo total del cargador: DRAW_MS + OPEN_MS = 1 s como máximo (docs/scroll-dinamico.md).

export const DRAW_MS = 600; // la planta se dibuja por líneas
export const OPEN_MS = 400; // las mitades del monograma se separan
const SESSION_KEY = 'ipuente-loader-visto';

export function shouldShowLoader() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markLoaderSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Sin sessionStorage: se mostrará de nuevo, no pasa nada.
  }
}

// Milisegundos que el hero espera antes de entrar: el dibujo más la mitad de la apertura, para que
// el contenido aparezca justo cuando las mitades del monograma se separan.
export function heroEntranceDelay() {
  return shouldShowLoader() ? DRAW_MS + OPEN_MS / 2 : 0;
}
