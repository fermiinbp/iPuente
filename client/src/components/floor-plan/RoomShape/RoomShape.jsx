// Una sala del plano 3D: caja de poca altura con su etiqueta. Sube al seleccionarla y baja al soltarla.
// El movimiento se hace mutando un ref en useFrame (sin setState) y pidiendo fotogramas solo mientras queda recorrido.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { BoxGeometry, EdgesGeometry } from 'three';
import RoomInterior from '../RoomInterior/RoomInterior.jsx';
import styles from './RoomShape.module.css';

const ALTURA = 0.12;
const ELEVACION = 0.3;
// Al pasar el ratón la sala sube un poco para indicar que se puede pulsar.
const ELEVACION_HOVER = 0.05;
const VELOCIDAD = 9;
const UMBRAL = 0.002;

export default function RoomShape({
  room,
  statusLabel,
  position,
  size,
  selected,
  material,
  lineBase,
  lineActive,
  reducedMotion,
  onSelect,
  // Interior y luz (opcionales: sin `recursos` la sala se dibuja como antes, sin paredes ni luz).
  recursos,
  doorSide = 1,
  lit = false,
}) {
  const invalidate = useThree((estado) => estado.invalidate);
  const elevador = useRef(null);
  const objetivo = useRef(0);
  const encima = useRef(false);

  const geometria = useMemo(() => new BoxGeometry(size[0], ALTURA, size[1]), [size]);
  const bordes = useMemo(() => new EdgesGeometry(geometria), [geometria]);

  useEffect(
    () => () => {
      geometria.dispose();
      bordes.dispose();
      document.body.style.cursor = '';
    },
    [geometria, bordes],
  );

  // Cambia el objetivo y pide fotogramas. Con movimiento reducido salta directo, sin animar.
  useEffect(() => {
    objetivo.current = selected ? ELEVACION : encima.current ? ELEVACION_HOVER : 0;
    if (reducedMotion && elevador.current) elevador.current.position.y = objetivo.current;
    invalidate();
  }, [selected, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    const grupo = elevador.current;
    if (!grupo) return;
    const resto = objetivo.current - grupo.position.y;
    if (Math.abs(resto) < UMBRAL) {
      grupo.position.y = objetivo.current;
      return;
    }
    grupo.position.y += resto * Math.min(1, delta * VELOCIDAD);
    invalidate();
  });

  const alPulsar = (evento) => {
    evento.stopPropagation();
    onSelect(room.id);
  };

  return (
    <group position={[position[0], 0, position[1]]}>
      <group ref={elevador}>
        <mesh
          geometry={geometria}
          material={material}
          position={[0, ALTURA / 2 + 0.01, 0]}
          onClick={alPulsar}
          onPointerOver={(evento) => {
            evento.stopPropagation();
            document.body.style.cursor = 'pointer';
            encima.current = true;
            if (!selected) objetivo.current = ELEVACION_HOVER;
            invalidate();
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
            encima.current = false;
            if (!selected) objetivo.current = 0;
            invalidate();
          }}
        />
        {recursos && (
          <RoomInterior
            room={room}
            size={size}
            doorSide={doorSide}
            lit={lit}
            recursos={recursos}
            reducedMotion={reducedMotion}
          />
        )}
        <lineSegments
          geometry={bordes}
          material={selected ? lineActive : lineBase}
          position={[0, ALTURA / 2 + 0.01, 0]}
        />
        <Html
          // Junto al borde delantero, para no tapar la mesa y las sillas del interior.
          position={[0, ALTURA + 0.1, size[1] / 2 - 0.16]}
          center
          pointerEvents="none"
          zIndexRange={[10, 0]}
          aria-hidden="true"
        >
          <span
            className={`${styles.chip} ${styles[room.status]} ${selected ? styles.selected : ''}`}
            aria-hidden="true"
          >
            {room.id}
            <span className={styles.long}> · {statusLabel}</span>
          </span>
        </Html>
      </group>
    </group>
  );
}
