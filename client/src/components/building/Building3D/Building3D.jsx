// Edificio 3D procedural del hero: una losa por planta y bloques de sala (instancias). La planta activa
// llega por props (los botones HTML mandan), se destaca con aristas lima y las de encima suben un poco.
// El arrastre horizontal gira el edificio con eventos pointer. Render bajo demanda: se llama a invalidate()
// solo mientras hay animación, inercia o arrastre.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import LazyCanvas from '@/components/three/LazyCanvas/LazyCanvas.jsx';
import { useCssColors } from '@/hooks/useCssColors.js';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import styles from './Building3D.module.css';

// Colores: solo tokens de :root.
const TOKENS = [
  'bronce',
  'bronce-claro',
  'crema',
  'crema-suave',
  'bosque-profundo',
  'lima',
  'libre',
  'ocupada',
  'no-alquila',
];

// Cámara del mockup: PerspectiveCamera(30) en (11.5, 9, 11.5) mirando a (0, 1.8, 0).
const CAMERA = { fov: 30, near: 0.1, far: 100, position: [11.5, 9, 11.5] };
const TARGET_Y = 1.8;
const FLOOR_STEP = 0.74; // altura entre plantas
const LIFT = 1.05; // cuánto suben las plantas de encima de la activa
const ROOM_Y = 0.28;
const ROOM_H = 0.46;
const INITIAL_ROTATION = -0.35;
const SLAB = [4.3, 0.1, 2.9];
// Centro y tamaño (x, z, ancho, fondo) de las seis salas de cada planta, como en el mockup.
const LAYOUT = [
  [-1.445, -0.8, 1.21, 1.1],
  [0.035, -0.8, 1.63, 1.1],
  [1.48, -0.8, 1.14, 1.1],
  [-1.135, 0.72, 1.83, 1.1],
  [0.46, 0.72, 1.24, 1.1],
  [1.595, 0.72, 0.91, 1.1],
];

const dummy = new Object3D();

function Floor({ level, rooms, active, lift, shared, reduced }) {
  const group = useRef(null);
  const mesh = useRef(null);
  const target = useRef(level * FLOOR_STEP);
  const invalidate = useThree((state) => state.invalidate);
  const { slabGeo, slabEdges, roomGeo, roomEdges, slabMat, roomMat, lineBase, lineActive, colors } =
    shared;
  const count = Math.min(rooms.length, LAYOUT.length);

  // Posición inicial, antes del primer render.
  useLayoutEffect(() => {
    if (group.current) group.current.position.y = target.current;
  }, []);

  // Objetivo de altura: las plantas de encima de la activa suben; con reduced-motion saltan sin animar.
  useEffect(() => {
    target.current = level * FLOOR_STEP + lift;
    if (reduced && group.current) group.current.position.y = target.current;
    invalidate();
  }, [level, lift, reduced, invalidate]);

  // Matrices y colores de las salas (instancias): las de la planta activa muestran su estado.
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    for (let i = 0; i < count; i++) {
      const [x, z, w, d] = LAYOUT[i];
      dummy.position.set(x, ROOM_Y, z);
      dummy.scale.set(w, ROOM_H, d);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
      let color = colors['bronce-claro'];
      if (active) {
        color =
          rooms[i] === 'free'
            ? colors.libre
            : rooms[i] === 'busy'
              ? colors.ocupada
              : colors['no-alquila'];
      }
      instanced.setColorAt(i, color);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    invalidate();
  }, [active, rooms, colors, count, invalidate]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const diff = target.current - g.position.y;
    if (Math.abs(diff) > 0.002) {
      g.position.y += diff * Math.min(1, delta * 6.5);
      invalidate();
    } else {
      g.position.y = target.current;
    }
  });

  const line = active ? lineActive : lineBase;
  const edgeItems = [];
  for (let i = 0; i < count; i++) {
    const [x, z, w, d] = LAYOUT[i];
    edgeItems.push(
      <lineSegments
        key={i}
        geometry={roomEdges}
        material={line}
        position={[x, ROOM_Y, z]}
        scale={[w, ROOM_H, d]}
      />,
    );
  }

  return (
    <group ref={group}>
      <mesh geometry={slabGeo} material={slabMat} />
      <lineSegments geometry={slabEdges} material={line} />
      <instancedMesh ref={mesh} args={[roomGeo, roomMat, count]} />
      {edgeItems}
    </group>
  );
}

function Building({ floors, activeFloorId, reduced }) {
  const colors = useCssColors(TOKENS);
  const root = useRef(null);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  // Geometrías y materiales: una sola vez; las salas se repiten como instancias.
  const shared = useMemo(() => {
    const slabGeo = new BoxGeometry(...SLAB);
    const roomGeo = new BoxGeometry(1, 1, 1);
    return {
      slabGeo,
      slabEdges: new EdgesGeometry(slabGeo),
      roomGeo,
      roomEdges: new EdgesGeometry(roomGeo),
      slabMat: new MeshStandardMaterial({ color: colors.bronce, roughness: 0.9 }),
      roomMat: new MeshStandardMaterial({ roughness: 0.8 }),
      lineBase: new LineBasicMaterial({ color: colors['crema-suave'] }),
      lineActive: new LineBasicMaterial({ color: colors.lima }),
      colors,
    };
  }, [colors]);

  useEffect(() => {
    return () => {
      shared.slabGeo.dispose();
      shared.slabEdges.dispose();
      shared.roomGeo.dispose();
      shared.roomEdges.dispose();
      shared.slabMat.dispose();
      shared.roomMat.dispose();
      shared.lineBase.dispose();
      shared.lineActive.dispose();
    };
  }, [shared]);

  useLayoutEffect(() => {
    camera.lookAt(0, TARGET_Y, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate]);

  useLayoutEffect(() => {
    if (root.current) root.current.rotation.y = INITIAL_ROTATION;
  }, []);

  // Giro por arrastre horizontal (eventos pointer). El scroll vertical lo gestiona el navegador (pan-y).
  useEffect(() => {
    const canvas = gl.domElement;
    const onDown = (event) => {
      dragging.current = true;
      lastX.current = event.clientX;
      velocity.current = 0;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event) => {
      if (!dragging.current || !root.current) return;
      const dx = event.clientX - lastX.current;
      lastX.current = event.clientX;
      root.current.rotation.y += dx * 0.008;
      velocity.current = reduced ? 0 : dx * 0.0016;
      invalidate();
    };
    const onEnd = (event) => {
      if (!dragging.current) return;
      dragging.current = false;
      canvas.releasePointerCapture?.(event.pointerId);
      if (velocity.current !== 0) invalidate();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('pointercancel', onEnd);
    };
  }, [gl, invalidate, reduced]);

  // Inercia corta tras soltar; se detiene sola (sin giro automático).
  useFrame(() => {
    if (dragging.current || !root.current) return;
    if (Math.abs(velocity.current) > 0.0004) {
      root.current.rotation.y += velocity.current;
      velocity.current *= 0.93;
      invalidate();
    } else {
      velocity.current = 0;
    }
  });

  const activeFloor = floors.find((floor) => floor.id === activeFloorId);
  const activeLevel = activeFloor ? activeFloor.number : null;

  return (
    <>
      <hemisphereLight args={[colors['crema-suave'], colors['bosque-profundo'], 1.05]} />
      <directionalLight color={colors.crema} intensity={0.8} position={[6, 10, 3]} />
      <group ref={root}>
        {floors.map((floor) => (
          <Floor
            key={floor.id}
            level={floor.number}
            rooms={floor.rooms ?? []}
            active={floor.id === activeFloorId}
            lift={activeLevel !== null && floor.number > activeLevel ? LIFT : 0}
            shared={shared}
            reduced={reduced}
          />
        ))}
      </group>
    </>
  );
}

export default function Building3D({ floors, activeFloorId, label, fallback = null }) {
  const reduced = useReducedMotion();
  return (
    <LazyCanvas label={label} fallback={fallback} camera={CAMERA} className={styles.escena}>
      <Building floors={floors} activeFloorId={activeFloorId} reduced={reduced} />
    </LazyCanvas>
  );
}
