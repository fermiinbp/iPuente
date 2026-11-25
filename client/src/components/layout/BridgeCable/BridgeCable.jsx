// Cable del puente: una curva fina de bronce que cuelga bajo la cabecera, de borde a borde, y marca lo leído de la
// página. Con el scroll el trazo se va dibujando, el cable se tensa (la curva se aplana) y un cuadradito de bronce
// (la «sala» del logo) se desliza por él. Va dentro de una cabecera `sticky`, así que se ve en toda la página.
// Es decorativo (aria-hidden, sin foco ni clics) y cuelga sobre el contenido sin empujarlo: no cambia `--alto-cabecera`.
// Todo el movimiento sale de `--progreso` (useScrollVar, modo 'page'); con prefers-reduced-motion queda quieto.
import { useRef } from 'react';
import { useScrollVar } from '@/hooks/useScrollVar.js';
import styles from './BridgeCable.module.css';

// Curva simétrica de 1000 × 16: de (0,0) a (1000,0) con control en (500,32), así que cuelga 16 en el centro y su
// x avanza linealmente con el parámetro (por eso la sala puede seguirla solo con CSS).
const CURVA = 'M0 0Q500 32 1000 0';

// Por defecto cuelga de su contenedor (una barra `sticky`, con `position: relative` o sticky). Con `fixed` se fija al borde
// superior de la ventana: para las pantallas sin barra, como el acceso y el registro (AuthLayout).
export default function BridgeCable({ fixed = false }) {
  const ref = useRef(null);
  useScrollVar(ref, { mode: 'page' });

  return (
    <div
      className={fixed ? `${styles.cable} ${styles.fijo}` : styles.cable}
      ref={ref}
      aria-hidden="true"
    >
      <svg
        className={styles.curva}
        viewBox="0 0 1000 16"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path className={styles.reposo} d={CURVA} />
        <path className={styles.recorrido} d={CURVA} pathLength="1" />
      </svg>
      <span className={styles.sala} />
    </div>
  );
}
