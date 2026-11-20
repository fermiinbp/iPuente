// ¿Se cumple una media query? Se actualiza si cambia (p. ej. al girar el móvil o cambiar el tamaño de la ventana).
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
