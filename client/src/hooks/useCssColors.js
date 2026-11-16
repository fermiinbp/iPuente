// Lee variables CSS de :root y las devuelve como colores de Three.js, para no escribir hexadecimales en las escenas 3D.
import { useMemo } from 'react';
import { Color } from 'three';

// Si una variable no existe se pinta en magenta: así se nota enseguida en pantalla en vez de fallar en silencio.
const AUSENTE = 'magenta';

function leerColor(nombre) {
  const variable = nombre.startsWith('--') ? nombre : `--${nombre}`;
  const valor =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return new Color(valor || AUSENTE);
}

/**
 * useCssColors(['bosque', 'lima']) → { bosque: Color, lima: Color }
 * Los nombres van con o sin «--». El resultado se memoiza por la lista de nombres.
 */
export function useCssColors(nombres) {
  const clave = nombres.join('|');
  return useMemo(() => {
    const colores = {};
    for (const nombre of clave.split('|')) colores[nombre] = leerColor(nombre);
    return colores;
  }, [clave]);
}
