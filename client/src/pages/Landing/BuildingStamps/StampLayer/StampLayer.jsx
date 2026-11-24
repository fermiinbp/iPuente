// Estampas de la cabecera. Dos disposiciones:
//  - 'anchored': sobre el edificio 3D, cada una a la altura de su planta (`--y-<índice>` en la lista, que escribe
//    quien recibe las anclas del 3D), una a cada lado y en versión compacta.
//  - 'list': rejilla normal (móvil y sin 3D).
// La aparición va ligada al progreso de scroll del almacén `store`: escribe `--k` (0 a 1) en cada estampa sin
// renderizar React, y deja `inert` las que aún no se ven para que el teclado no entre en ellas. Siempre son
// botones reales en el DOM, así que sirven también como lista de salas para teclado y lectores de pantalla.
import { useLayoutEffect, useRef } from 'react';
import RoomStamp from '@/components/room/RoomStamp/RoomStamp.jsx';
import { stampProgress } from '@/utils/scrollTimeline.js';
import styles from './StampLayer.module.css';

const VISIBLE_FROM = 0.3; // por debajo de este `--k` la estampa aún no se ve ni se puede enfocar

export default function StampLayer({ stamps, mode, store, onOpen, ref }) {
  const itemsRef = useRef([]);

  useLayoutEffect(() => {
    const apply = (p) => {
      itemsRef.current.forEach((item, index) => {
        if (!item) return;
        const k = stampProgress(p, index, stamps.length);
        item.style.setProperty('--k', k.toFixed(3));
        item.inert = k < VISIBLE_FROM;
      });
    };
    apply(store.get());
    return store.subscribe(apply);
  }, [store, stamps.length]);

  const anchored = mode === 'anchored';
  return (
    <ol
      ref={ref}
      className={anchored ? styles.capa : styles.lista}
      aria-label="Salas destacadas del edificio"
    >
      {stamps.map((stamp, index) => {
        const side = index % 2 === 0 ? styles.izquierda : styles.derecha;
        return (
          <li
            key={stamp.id}
            ref={(element) => {
              itemsRef.current[index] = element;
            }}
            className={anchored ? `${styles.item} ${side}` : styles.celda}
            style={{
              ...(anchored ? { '--y': `var(--y-${index}, ${12 + index * 14}%)` } : null),
              '--giro': `${index % 2 === 0 ? -2 : 2}deg`,
            }}
          >
            <RoomStamp room={stamp} onOpen={onOpen} compact={anchored} />
          </li>
        );
      })}
    </ol>
  );
}
