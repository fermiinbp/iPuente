// Progreso de scroll de un elemento (0 a 1), para movimiento guiado por el scroll (pasos 4 y 5 de docs/scroll-dinamico.md).
// Escribe `--progreso` en el elemento (el CSS lo usa sin renderizar React) y, si se pasa, llama a `onProgress(p)`
// (para mover algo de Three.js sin volver a renderizar). Solo escucha el scroll mientras el elemento está cerca de la
// pantalla, con un `requestAnimationFrame` por fotograma como máximo y el listener en modo pasivo.
//   mode 'view': 0 cuando el elemento asoma por abajo y 1 cuando sale por arriba.
//   mode 'pin':  para un contenedor alto con un hijo `sticky`: 0 al empezar a fijarse y 1 al soltarse.
//   mode 'page': progreso de lectura de toda la página (0 arriba, 1 abajo), para un elemento fijo como el cable del
//                puente bajo la cabecera. Escucha siempre (el elemento no sale de la pantalla) y se recalcula si la
//                página cambia de alto (ResizeObserver sobre <body>).
// Con prefers-reduced-motion no escucha nada: deja `--progreso` en 1 (estado final para el CSS; en modo 'page', en 0,
// que es el elemento parado) y no llama a `onProgress`.
import { useEffect, useRef } from 'react';

const clamp = (value) => Math.min(1, Math.max(0, value));

// Parte pura: `rect` es el getBoundingClientRect() del elemento y `vh` el alto de la ventana.
export function progressOf(rect, vh, mode = 'view') {
  if (mode === 'pin') {
    const span = rect.height - vh;
    if (span <= 0) return rect.top <= 0 ? 1 : 0;
    return clamp(-rect.top / span);
  }
  return clamp((vh - rect.top) / (vh + rect.height));
}

// Parte pura del modo 'page': `scrollY` es lo desplazado, `scrollHeight` el alto total del documento y `vh` el de la
// ventana. Una página que cabe entera en la ventana no tiene recorrido: 0.
export function pageProgressOf(scrollY, scrollHeight, vh) {
  const span = scrollHeight - vh;
  if (span <= 0) return 0;
  return clamp(scrollY / span);
}

export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function useScrollProgress(ref, { mode = 'view', onProgress } = {}) {
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const apply = (progress) => {
      element.style.setProperty('--progreso', progress.toFixed(4));
      callback.current?.(progress);
    };

    if (mode === 'page') {
      if (prefersReducedMotion()) {
        element.style.setProperty('--progreso', '0');
        return undefined;
      }
      let pageFrame = 0;
      const updatePage = () => {
        pageFrame = 0;
        apply(
          pageProgressOf(window.scrollY, document.documentElement.scrollHeight, window.innerHeight),
        );
      };
      const requestPage = () => {
        if (!pageFrame) pageFrame = requestAnimationFrame(updatePage);
      };
      window.addEventListener('scroll', requestPage, { passive: true });
      window.addEventListener('resize', requestPage);
      const resizeObserver =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(requestPage);
      resizeObserver?.observe(document.body);
      requestPage();
      return () => {
        window.removeEventListener('scroll', requestPage);
        window.removeEventListener('resize', requestPage);
        resizeObserver?.disconnect();
        if (pageFrame) cancelAnimationFrame(pageFrame);
      };
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      // Estado final solo para el CSS: no se avisa a `onProgress`, para que nada se mueva por el scroll.
      element.style.setProperty('--progreso', '1');
      return undefined;
    }

    let frame = 0;
    let listening = false;
    const update = () => {
      frame = 0;
      apply(progressOf(element.getBoundingClientRect(), window.innerHeight, mode));
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const listen = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', request);
    };
    const stop = () => {
      listening = false;
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          listen();
        } else {
          stop();
        }
        // Al entrar y al salir se fija el valor real (0 o 1 si el elemento queda fuera por un extremo).
        request();
      },
      { rootMargin: '20% 0px' },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      stop();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, mode]);
}
