// Pantalla de carga de la Landing: una planta se dibuja por líneas sobre el monograma «iP» y, al acabar,
// las dos mitades del monograma se separan como una puerta. Dura 1 s como máximo (DRAW_MS + OPEN_MS).
// Aísla la página (inert + sin scroll) mientras dura, se puede saltar (clic o Escape) y solo se muestra
// una vez por sesión. Nunca se muestra con prefers-reduced-motion: reduce. Todo el movimiento es CSS.
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DRAW_MS,
  markLoaderSeen as markSeen,
  OPEN_MS,
  shouldShowLoader,
} from '../loaderSession.js';
import styles from './LandingLoader.module.css';

const SAFETY_MS = 2500;

// Planta de ejemplo: el contorno y los muros que la dividen en cinco salas. `delay` en ms.
const PLAN_LINES = [
  { d: 'M2 2H198V108H2Z', delay: 0 },
  { d: 'M100 2V60', delay: 120 },
  { d: 'M2 60H198', delay: 200 },
  { d: 'M60 60V108', delay: 280 },
  { d: 'M140 60V108', delay: 340 },
];

export default function LandingLoader() {
  // Fases: dibuja (se traza la planta), abre (las mitades se separan) y done (se desmonta).
  const [active] = useState(shouldShowLoader);
  const [fase, setFase] = useState('dibuja');
  const [done, setDone] = useState(false);

  const skip = useCallback(() => setFase('abre'), []);

  // Aislamiento: página inerte y sin scroll mientras el cargador está activo.
  useEffect(() => {
    if (!active || done) return undefined;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    root?.setAttribute('inert', '');
    html.style.overflow = 'hidden';
    return () => {
      root?.removeAttribute('inert');
      html.style.overflow = prevOverflow;
    };
  }, [active, done]);

  // La sesión lo da por visto y, pase lo que pase, el cargador no se queda más de SAFETY_MS.
  useEffect(() => {
    if (!active) return undefined;
    markSeen();
    const safetyTimer = setTimeout(() => setDone(true), SAFETY_MS);
    return () => clearTimeout(safetyTimer);
  }, [active]);

  // Fase de dibujo: tras DRAW_MS se abre (o antes, si se salta).
  useEffect(() => {
    if (!active || fase !== 'dibuja') return undefined;
    const timer = setTimeout(() => setFase('abre'), DRAW_MS);
    return () => clearTimeout(timer);
  }, [active, fase]);

  // Saltar con Escape.
  useEffect(() => {
    if (!active || done) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') skip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, done, skip]);

  // Al abrir, se desmonta cuando termina la transición.
  useEffect(() => {
    if (fase !== 'abre') return undefined;
    const timer = setTimeout(() => setDone(true), OPEN_MS);
    return () => clearTimeout(timer);
  }, [fase]);

  if (!active || done) return null;

  return createPortal(
    <div
      className={styles.loader}
      data-fase={fase}
      style={{ '--dur-abre': `${OPEN_MS}ms` }}
      onClick={skip}
    >
      <p className={styles.sr} role="status">
        {fase === 'abre' ? 'Listo' : 'Cargando iPuente'}
      </p>
      <div className={`${styles.layer} ${styles.top}`} aria-hidden="true">
        <span className={styles.mono}>
          <em>i</em>P
        </span>
      </div>
      <div className={`${styles.layer} ${styles.bottom}`} aria-hidden="true">
        <span className={styles.mono}>
          <em>i</em>P
        </span>
      </div>
      <svg className={styles.plan} viewBox="0 0 200 110" aria-hidden="true" focusable="false">
        {PLAN_LINES.map((line) => (
          <path
            key={line.d}
            d={line.d}
            pathLength="1"
            className={styles.trazo}
            style={{ '--retardo': `${line.delay}ms` }}
          />
        ))}
      </svg>
      <div className={styles.band} aria-hidden="true" />
    </div>,
    document.body,
  );
}
