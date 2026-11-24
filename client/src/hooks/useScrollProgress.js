// Mide el progreso de scroll (0 a 1) de un elemento y lo escribe en un almacén (`createProgressStore`), sin estado de
// React. Dos modos (cálculo en utils/scrollTimeline.js):
//  - 'pin': el elemento es una pista alta con un hijo fijado (`pinRef`, position: sticky).
//  - 'view': sin fijado; 0 cuando asoma por abajo y 1 al llegar al 30 % de la ventana.
// Solo escucha el scroll mientras el elemento está cerca de la pantalla (listener pasivo y un
// requestAnimationFrame por fotograma). Con `prefers-reduced-motion` deja el progreso en 1 y no escucha nada.
import { useEffect } from 'react';
import { pinProgress, viewProgress } from '@/utils/scrollTimeline.js';
import { useReducedMotion } from './useReducedMotion.js';

export function useScrollProgress(trackRef, { store, mode = 'pin', pinRef, enabled = true }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track || !store) return undefined;
    if (reduced) {
      store.set(1);
      return undefined;
    }

    let frame = 0;
    let listening = false;
    let stickyTop = 0;

    const readSticky = () => {
      const pin = pinRef?.current;
      stickyTop = pin ? parseFloat(window.getComputedStyle(pin).top) || 0 : 0;
    };
    const measure = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      store.set(
        mode === 'pin'
          ? pinProgress({
              trackTop: rect.top,
              trackHeight: rect.height,
              pinHeight: pinRef?.current?.offsetHeight ?? 0,
              stickyTop,
            })
          : viewProgress({ top: rect.top, viewport: window.innerHeight }),
      );
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const onResize = () => {
      readSticky();
      request();
    };
    const listen = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', onResize);
    };
    const unlisten = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', onResize);
    };

    readSticky();
    measure();
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) listen();
              else unlisten();
              request(); // al salir, deja el valor final (0 o 1)
            },
            { rootMargin: '200px 0px' },
          );
    if (observer) observer.observe(track);
    else listen();

    return () => {
      observer?.disconnect();
      unlisten();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [trackRef, store, mode, pinRef, enabled, reduced]);
}
