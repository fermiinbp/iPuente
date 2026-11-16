// Comprueba, una sola vez, si el navegador puede crear un contexto WebGL.
let disponible;

export function hasWebGL() {
  if (disponible !== undefined) return disponible;
  if (typeof document === 'undefined') return false;
  try {
    const lienzo = document.createElement('canvas');
    const contexto = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
    disponible = Boolean(contexto);
    // Se libera el contexto de prueba para no gastar uno de los pocos que permite el navegador.
    contexto?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    disponible = false;
  }
  return disponible;
}
