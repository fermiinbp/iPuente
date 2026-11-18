// Pone el título del documento («Título · iPuente») y restaura el anterior al salir de la página.
import { useEffect } from 'react';

export function usePageTitle(titulo) {
  useEffect(() => {
    const anterior = document.title;
    document.title = `${titulo} · iPuente`;
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}
