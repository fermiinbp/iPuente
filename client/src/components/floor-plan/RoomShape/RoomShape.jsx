// Una sala del plano 3D: caja de poca altura con su etiqueta. Sube al seleccionarla y baja al soltarla.
// El movimiento se hace mutando un ref en useFrame (sin setState) y pidiendo fotogramas solo mientras queda recorrido.
// Con `intro` la sala se dibuja al montarse: primero se traza su contorno (drawRange de las aristas) y después sube su
// relleno del color de su estado; la etiqueta y el interior aparecen al terminar. Sin `intro`, o con movimiento reducido, sale entera.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { BoxGeometry, EdgesGeometry } from 'three';
import RoomInterior from '../RoomInterior/RoomInterior.jsx';
import styles from './RoomShape.module.css';

const ALTURA = 0.12;
const ELEVACION = 0.3;
// Al pasar el ratón la sala sube un poco para indicar que se puede pulsar.
const ELEVACION_HOVER = 0.16;
const VELOCIDAD = 9;
const UMBRAL = 0.002;
// Dibujo de la sala (ms): el trazo del contorno y, cuando va por el 60 %, empieza a subir el relleno.
const TRAZO_MS = 500;
const RELLENO_MS = 400;
const ENTRADA_RELLENO = 0.6;
const suave = (t) => 1 - (1 - t) ** 3;
const entre = (t) => Math.min(1, Math.max(0, t));

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
  intro = false,
  introDelay = 0,
}) {
  const invalidate = useThree((estado) => estado.invalidate);
  const elevador = useRef(null);
  const objetivo = useRef(0);
  // Con el ratón encima la sala sube, se perfila en lima y enseña un adelanto de su luz.
  const [encima, setEncima] = useState(false);
  // Dibujo inicial: `listo` pasa a true una sola vez al terminar (un único render); el resto va en refs.
  const [listo, setListo] = useState(() => !intro || reducedMotion);
  const transcurrido = useRef(0);
  const cajaRef = useRef(null);

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

  // Pose de partida del dibujo antes del primer pintado: sin contorno y con el relleno aplastado.
  useLayoutEffect(() => {
    if (listo) return;
    bordes.setDrawRange(0, 0);
    if (cajaRef.current) {
      cajaRef.current.scale.y = 0.001;
      cajaRef.current.position.y = 0.01;
    }
    invalidate();
  }, [listo, bordes, invalidate]);

  // Cambia el objetivo y pide fotogramas. Con movimiento reducido salta directo, sin animar.
  useEffect(() => {
    objetivo.current = selected ? ELEVACION : encima ? ELEVACION_HOVER : 0;
    if (reducedMotion && elevador.current) elevador.current.position.y = objetivo.current;
    invalidate();
  }, [selected, encima, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    if (!listo) {
      // delta acotado: el primer fotograma (compilar shaders) puede tardar y se comería el dibujo.
      transcurrido.current += Math.min(delta, 0.05) * 1000;
      const t = transcurrido.current - introDelay;
      const trazo = suave(entre(t / TRAZO_MS));
      const relleno = suave(entre((t - TRAZO_MS * ENTRADA_RELLENO) / RELLENO_MS));
      // Las aristas van de dos en dos vértices: el trazo avanza por segmentos completos.
      bordes.setDrawRange(0, 2 * Math.floor((trazo * bordes.attributes.position.count) / 2));
      if (cajaRef.current) {
        const escala = Math.max(0.001, relleno);
        cajaRef.current.scale.y = escala;
        cajaRef.current.position.y = 0.01 + (ALTURA * escala) / 2;
      }
      if (trazo >= 1 && relleno >= 1) {
        bordes.setDrawRange(0, Infinity);
        setListo(true);
      }
      invalidate();
    }
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
          ref={cajaRef}
          geometry={geometria}
          material={material}
          position={[0, ALTURA / 2 + 0.01, 0]}
          onClick={alPulsar}
          onPointerOver={(evento) => {
            evento.stopPropagation();
            document.body.style.cursor = 'pointer';
            setEncima(true);
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
            setEncima(false);
          }}
        />
        {recursos && listo && (
          <RoomInterior
            room={room}
            size={size}
            doorSide={doorSide}
            lit={lit}
            hover={encima}
            recursos={recursos}
            reducedMotion={reducedMotion}
          />
        )}
        <lineSegments
          geometry={bordes}
          material={selected || encima ? lineActive : lineBase}
          position={[0, ALTURA / 2 + 0.01, 0]}
        />
        {listo && (
          <Html
            // Junto al borde delantero, para no tapar la mesa y las sillas del interior.
            position={[0, ALTURA + 0.1, size[1] / 2 - 0.16]}
            center
            pointerEvents="none"
            zIndexRange={[10, 0]}
            aria-hidden="true"
          >
            <span
              className={`${styles.chip} ${styles[room.status]} ${selected ? styles.selected : ''} ${encima ? styles.hover : ''}`}
              aria-hidden="true"
            >
              {room.label ?? room.id}
              <span className={styles.long}> · {statusLabel}</span>
            </span>
          </Html>
        )}
      </group>
    </group>
  );
}
