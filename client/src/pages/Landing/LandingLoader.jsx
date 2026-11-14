// Pantalla de carga de la Landing: el monograma «iP» se parte en dos y se abre como una puerta.
// Se muestra una vez por sesión y nunca con prefers-reduced-motion: reduce.
import { useEffect, useState } from 'react';
import simbolo from '@/assets/images/ipuente-simbolo.svg';
import styles from './LandingLoader.module.css';

const LOAD_MS = 1900;
const HOLD_MS = 350;
const OPEN_MS = 1400;
const SAFETY_MS = 7000;
const SESSION_KEY = 'ipuente-loader-visto';
const START_GAP = 3;

function shouldShowLoader() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Sin sessionStorage: se mostrará de nuevo, no pasa nada.
  }
}

export default function LandingLoader() {
  // Fases: load (0 a 100 %), open (se abre el monograma) y done (se desmonta).
  const [active] = useState(shouldShowLoader);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, gap: START_GAP, opening: 0 });

  useEffect(() => {
    if (!active) return undefined;
    markSeen();

    const start = performance.now();
    const height = window.innerHeight || 900;
    let frame = 0;

    const safetyTimer = setTimeout(() => {
      cancelAnimationFrame(frame);
      setDone(true);
    }, SAFETY_MS);

    const step = (now) => {
      const t = now - start;
      if (t < LOAD_MS + HOLD_MS) {
        const pct = Math.min(100, Math.floor((t / LOAD_MS) * 100));
        setProgress((prev) => (prev.pct === pct ? prev : { ...prev, pct }));
      } else {
        const opening = Math.min(1, (t - LOAD_MS - HOLD_MS) / OPEN_MS);
        if (opening >= 1) {
          clearTimeout(safetyTimer);
          setDone(true);
          return;
        }
        const eased = 1 - Math.pow(1 - opening, 3);
        setProgress({ pct: 100, gap: START_GAP + eased * height * 1.2, opening });
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(safetyTimer);
    };
  }, [active]);

  if (!active || done) return null;

  const { pct, gap, opening } = progress;
  const announced = Math.floor(pct / 25) * 25;
  const cssVars = {
    '--gap': `${gap}px`,
    '--band-opacity': Math.max(0, 1 - gap / 220),
    '--counter-opacity': Math.max(0, 1 - opening * 5),
    '--pct': `${pct}%`,
  };

  return (
    <div className={styles.loader} style={cssVars}>
      <p className={styles.sr} role="status">
        Cargando iPuente, {announced} por ciento
      </p>
      <div className={styles.band} aria-hidden="true" />
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
          <span className={styles.pct}>{pct}%</span>
          <div className={styles.track}>
            <div className={styles.line} />
          </div>
        </div>
      </div>
    </div>
  );
}
