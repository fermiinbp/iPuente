// Dice cuándo un elemento se acerca a la pantalla, para montar piezas pesadas (mapas, 3D) solo entonces.
// Uso: const [ref, near] = useNearViewport(); <div ref={ref}>{near && <Pesado />}</div>. Es true la primera vez que el
// elemento entra en `rootMargin` y ya no vuelve a false. Sin IntersectionObserver devuelve true desde el principio.
import { useEffect, useState } from 'react';

export function useNearViewport(rootMargin = '400px') {
  const [element, setElement] = useState(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (near || !element) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, near, rootMargin]);

  return [setElement, near];
}
