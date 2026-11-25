// Título que se revela por líneas: cada palabra sube desde detrás de una máscara y las palabras de una misma línea
// entran juntas, con un retraso de 90 ms por línea. Se dispara una sola vez, cuando el título entra en pantalla.
// Uso: <Reveal as="h1" className={styles.title} text="Encuentra tu sala" />. `text` es siempre texto plano.
// El texto completo va en un <span> solo para lectores de pantalla y las palabras partidas son aria-hidden.
// Con prefers-reduced-motion se pinta el texto tal cual, sin partir ni mover nada. Sin librerías: solo CSS
// (transform + transition) y un IntersectionObserver. Si el texto cambia, usa `key={text}` para repetirlo.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/hooks/useScrollVar.js';
import styles from './Reveal.module.css';

// Línea de cada palabra según su posición vertical; se guarda en `--linea` para el retraso escalonado.
function markLines(container) {
  let line = -1;
  let lastTop = null;
  container.querySelectorAll('[data-palabra]').forEach((word) => {
    if (lastTop === null || Math.abs(word.offsetTop - lastTop) > 2) {
      line += 1;
      lastTop = word.offsetTop;
    }
    word.style.setProperty('--linea', String(line));
  });
}

export default function Reveal({ as: Tag = 'span', text, className = '', ...rest }) {
  const ref = useRef(null);
  const [still] = useState(prefersReducedMotion);
  // Sin IntersectionObserver el título se ve desde el principio.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  // Líneas: al montar, al cargar las tipografías y cuando cambia el ancho (cambia dónde se parte el texto).
  useLayoutEffect(() => {
    const container = ref.current;
    if (still || !container) return undefined;
    markLines(container);
    document.fonts?.ready.then(() => markLines(container));
    let width = container.clientWidth;
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === width) return;
      width = container.clientWidth;
      markLines(container);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [still, text]);

  // Una sola vez: al entrar en pantalla (o al instante si no hay IntersectionObserver).
  useEffect(() => {
    const container = ref.current;
    if (still || shown || !container) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [still, shown, text]);

  if (still) {
    return (
      <Tag className={className || undefined} {...rest}>
        {text}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={[styles.reveal, className].filter(Boolean).join(' ')}
      data-visible={shown || undefined}
      {...rest}
    >
      <span className={styles.sr}>{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <Fragment key={`${word}-${index}`}>
            <span className={styles.palabra} data-palabra>
              <span className={styles.texto}>{word}</span>
            </span>
            {index < words.length - 1 ? ' ' : null}
          </Fragment>
        ))}
      </span>
    </Tag>
  );
}
