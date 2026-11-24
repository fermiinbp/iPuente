// Fondo con profundidad detrás del edificio del hero: degradado, dos formas orgánicas, halo de luz, suelo y grano.
// Solo CSS y decorativo (aria-hidden, sin clics). Si recibe el almacén de progreso de scroll (`store`), las formas se
// desplazan un poco a distinta velocidad (parallax suave, `--sy`); con movimiento reducido el progreso vale 1 y
// no hay desplazamiento.
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import { backdropShift } from '@/utils/scrollTimeline.js';
import styles from './BuildingBackdrop.module.css';

export default function BuildingBackdrop({ store }) {
  const raiz = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = raiz.current;
    if (!store || !element || reduced) return undefined;
    const apply = (p) => element.style.setProperty('--sy', `${backdropShift(p).toFixed(1)}px`);
    apply(store.get());
    return store.subscribe(apply);
  }, [store, reduced]);

  return (
    <div ref={raiz} className={styles.fondo} aria-hidden="true">
      <span className={`${styles.forma} ${styles.formaLejana}`} />
      <span className={`${styles.forma} ${styles.formaCercana}`} />
      <span className={styles.halo} />
      <span className={styles.suelo} />
      <span className={styles.grano} />
    </div>
  );
}
