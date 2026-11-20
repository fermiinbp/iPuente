// Pantalla de carga de la Landing: el monograma «iP» se parte en dos mitades que se separan como una puerta.
// Aísla la página (inert + sin scroll) mientras dura, se puede saltar y solo se muestra una vez por sesión.
// Nunca se muestra con prefers-reduced-motion: reduce.
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import simbolo from '@/assets/images/ipuente-simbolo.svg';
import {
  HOLD_MS,
  LOAD_MS,
  markLoaderSeen as markSeen,
  OPEN_MS,
  shouldShowLoader,
} from '../loaderSession.js';
import styles from './LandingLoader.module.css';

const SAFETY_MS = 4000;

export default function LandingLoader() {
  // Fases: carga (contador 0 a 100 %), abre (las mitades se separan) y done (se desmonta).
  const [active] = useState(shouldShowLoader);
  const [fase, setFase] = useState('carga');
  const [done, setDone] = useState(false);
  const [pct, setPct] = useState(0);

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

  // Fase de carga: solo el contador y la línea se actualizan desde JavaScript.
  useEffect(() => {
    if (!active) return undefined;
    markSeen();

    const start = performance.now();
    let frame = 0;

    const safetyTimer = setTimeout(() => {
      cancelAnimationFrame(frame);
      setDone(true);
    }, SAFETY_MS);

    const step = (now) => {
      const t = now - start;
      setPct(Math.min(100, Math.floor((t / LOAD_MS) * 100)));
      if (t >= LOAD_MS + HOLD_MS) {
        setFase('abre');
        return;
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(safetyTimer);
    };
  }, [active]);

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

  const progress = fase === 'abre' ? 1 : Math.min(pct, 100) / 100;
  const shown = fase === 'abre' ? 100 : pct;

  return createPortal(
    <div
      className={styles.loader}
      data-fase={fase}
      style={{ '--prog': progress, '--dur-abre': `${OPEN_MS}ms` }}
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
        <div className={styles.counter}>
          <img className={styles.symbol} src={simbolo} alt="" width="64" height="64" />
          <span className={styles.pct}>{shown}%</span>
          <div className={styles.track}>
            <div className={styles.line} />
          </div>
        </div>
      </div>
      <div className={styles.band} aria-hidden="true" />
    </div>,
    document.body,
  );
}
