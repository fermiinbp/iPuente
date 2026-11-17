// Cuándo se muestra la pantalla de carga de la Landing y cuánto tarda en abrirse.
// Vive aparte para que el hero pueda esperar a que termine antes de hacer su entrada.

export const LOAD_MS = 1100;
export const HOLD_MS = 250;
export const OPEN_MS = 900;
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

// Milisegundos que el hero espera antes de entrar: la carga más la mitad de la apertura, para que
// el contenido aparezca justo cuando las mitades del monograma se separan.
export function heroEntranceDelay() {
  return shouldShowLoader() ? LOAD_MS + HOLD_MS + OPEN_MS / 2 : 0;
}
