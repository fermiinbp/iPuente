// Edificio 3D procedural del hero: una losa por planta y bloques de sala (instancias). La planta activa
// llega por props (los botones HTML mandan), se destaca con la losa lima (el edificio es verde bosque: libre, ocupada, no se alquila) y las de encima
// suben un poco. El arrastre horizontal gira el edificio con eventos pointer. Render bajo demanda: se
// llama a invalidate() solo mientras hay animación, inercia o arrastre. Sin sombras ni suelo: el volumen
// lo dan la luz y los bordes.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import LazyCanvas from '@/components/three/LazyCanvas/LazyCanvas.jsx';
import { useCssColors } from '@/hooks/useCssColors.js';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import styles from './Building3D.module.css';

// Colores: solo tokens de :root.
const TOKENS = [
  'linea-plano',
  'crema',
  'crema-suave',
  'bosque-profundo',
  'lima',
  'libre',
  'ocupada',
  'no-alquila',
  'trama-no-alquila',
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
const ROOF = [4.4, 0.08, 3.0];
const ROOF_Y = 0.05 + ROOM_H + ROOF[1] / 2; // sobre las salas de la última planta
const DOOR = [0.7, 0.7, 0.1];
const DOOR_POS = [0, 0.05 + DOOR[1] / 2, SLAB[2] / 2];
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
const blanco = new Color(1, 1, 1);

// Trama diagonal a 45° de «No se alquila» (misma idea que FloorPlan), con colores leídos de los tokens.
function crearTrama(fondo, raya) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 32;
  lienzo.height = 32;
  const cx = lienzo.getContext('2d');
  cx.fillStyle = fondo.getStyle();
  cx.fillRect(0, 0, 32, 32);
  cx.strokeStyle = raya.getStyle();
  cx.lineWidth = 3;
  for (let i = -32; i < 64; i += 8) {
    cx.beginPath();
    cx.moveTo(i, 32);
    cx.lineTo(i + 32, 0);
    cx.stroke();
  }
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.wrapS = RepeatWrapping;
  textura.wrapT = RepeatWrapping;
  textura.repeat.set(2, 2);
  return textura;
}

// Aristas de la losa y de las seis salas fusionadas en un solo conjunto de segmentos (una draw call por planta).
function aristasDePlanta(slabEdges, roomEdges) {
  const posiciones = [];
  const añade = (geometria, sx, sy, sz, px, py, pz) => {
    const attr = geometria.getAttribute('position');
    for (let i = 0; i < attr.count; i++) {
      posiciones.push(attr.getX(i) * sx + px, attr.getY(i) * sy + py, attr.getZ(i) * sz + pz);
    }
  };
  añade(slabEdges, 1, 1, 1, 0, 0, 0);
  for (const [x, z, w, d] of LAYOUT) añade(roomEdges, w, ROOM_H, d, x, ROOM_Y, z);
  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new Float32BufferAttribute(posiciones, 3));
  return geometria;
}

function Floor({ level, rooms, active, off, top, lift, shared, reduced }) {
  const group = useRef(null);
  const meshA = useRef(null);
  const meshB = useRef(null);
  const target = useRef(level * FLOOR_STEP);
  const invalidate = useThree((state) => state.invalidate);
  const {
    slabGeo,
    slabEdges,
    floorEdges,
    roomGeo,
    roofGeo,
    doorGeo,
    slabMat,
    slabActiveMat,
    roomMat,
    hatchMat,
    roofMat,
    doorMat,
    lineBase,
    colors,
  } = shared;
  const count = off ? 0 : Math.min(rooms.length, LAYOUT.length);

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

  // Matrices y colores de las salas (instancias). En la planta activa las «No se alquila» van aparte
  // (segundo instancedMesh con trama); el resto, con su color de estado o en verde libre si la planta no está activa.
  useLayoutEffect(() => {
    const a = meshA.current;
    const b = meshB.current;
    let ia = 0;
    let ib = 0;
    for (let i = 0; i < count; i++) {
      const [x, z, w, d] = LAYOUT[i];
      dummy.position.set(x, ROOM_Y, z);
      dummy.scale.set(w, ROOM_H, d);
      dummy.updateMatrix();
      if (active && rooms[i] !== 'free' && rooms[i] !== 'busy') {
        b?.setMatrixAt(ib++, dummy.matrix);
      } else if (a) {
        let color = colors.libre;
        if (active) color = rooms[i] === 'free' ? colors.libre : colors.ocupada;
        a.setMatrixAt(ia, dummy.matrix);
        a.setColorAt(ia, color);
        ia++;
      }
    }
    if (a) {
      a.count = ia;
      a.instanceMatrix.needsUpdate = true;
      if (a.instanceColor) a.instanceColor.needsUpdate = true;
      a.computeBoundingSphere();
    }
    if (b) {
      b.count = ib;
      b.instanceMatrix.needsUpdate = true;
      b.computeBoundingSphere();
    }
    invalidate();
  }, [active, rooms, colors, count, invalidate]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const diff = target.current - g.position.y;
    if (reduced) {
      g.position.y = target.current;
    } else if (Math.abs(diff) > 0.002) {
      g.position.y += diff * Math.min(1, delta * 12);
      invalidate();
    } else {
      g.position.y = target.current;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={slabGeo} material={active ? slabActiveMat : slabMat} />
      <lineSegments geometry={off ? slabEdges : floorEdges} material={lineBase} />
      {count > 0 && <instancedMesh ref={meshA} args={[roomGeo, roomMat, count]} />}
      {count > 0 && active && <instancedMesh ref={meshB} args={[roomGeo, hatchMat, count]} />}
      {off && <mesh geometry={doorGeo} material={doorMat} position={DOOR_POS} />}
      {top && <mesh geometry={roofGeo} material={roofMat} position={[0, ROOF_Y, 0]} />}
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

  // Geometrías, materiales y textura: una sola vez; las salas se repiten como instancias.
  const shared = useMemo(() => {
    const slabGeo = new BoxGeometry(...SLAB);
    const roomGeo = new BoxGeometry(1, 1, 1);
    const slabEdges = new EdgesGeometry(slabGeo);
    const roomEdges = new EdgesGeometry(roomGeo);
    const floorEdges = aristasDePlanta(slabEdges, roomEdges);
    roomEdges.dispose();
    const trama = crearTrama(colors['no-alquila'], colors['trama-no-alquila']);
    const mate = (color, roughness) =>
      new MeshStandardMaterial({ color, roughness, toneMapped: false });
    return {
      slabGeo,
      slabEdges,
      floorEdges,
      roomGeo,
      roofGeo: new BoxGeometry(...ROOF),
      doorGeo: new BoxGeometry(...DOOR),
      trama,
      slabMat: mate(colors['linea-plano'], 0.9),
      slabActiveMat: mate(colors.lima, 0.7),
      roomMat: mate(blanco, 0.8),
      hatchMat: new MeshStandardMaterial({ map: trama, roughness: 0.9, toneMapped: false }),
      roofMat: mate(colors['linea-plano'], 0.9),
      doorMat: mate(colors['bosque-profundo'], 0.9),
      lineBase: new LineBasicMaterial({ color: colors['bosque-profundo'], toneMapped: false }),
      colors,
    };
  }, [colors]);

  useEffect(() => {
    return () => {
      shared.slabGeo.dispose();
      shared.slabEdges.dispose();
      shared.floorEdges.dispose();
      shared.roomGeo.dispose();
      shared.roofGeo.dispose();
      shared.doorGeo.dispose();
      shared.trama.dispose();
      shared.slabMat.dispose();
      shared.slabActiveMat.dispose();
      shared.roomMat.dispose();
      shared.hatchMat.dispose();
      shared.roofMat.dispose();
      shared.doorMat.dispose();
      shared.lineBase.dispose();
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

  // Inercia corta tras soltar, independiente de los fps; se detiene sola (sin giro automático).
  useFrame((_, delta) => {
    if (dragging.current || !root.current) return;
    if (reduced) {
      velocity.current = 0;
      return;
    }
    if (Math.abs(velocity.current) > 0.0004) {
      // velocity es radianes por fotograma a 60 fps: se escala con delta para que el recorrido no dependa de los fps.
      root.current.rotation.y += velocity.current * delta * 60;
      velocity.current *= Math.pow(0.93, delta * 60);
      invalidate();
    } else {
      velocity.current = 0;
    }
  });

  const activeFloor = floors.find((floor) => floor.id === activeFloorId);
  const activeLevel = activeFloor ? activeFloor.number : null;
  const topLevel = floors.reduce((max, floor) => Math.max(max, floor.number), -Infinity);

  return (
    <>
      <hemisphereLight args={[colors['crema-suave'], colors['bosque-profundo'], 0.5]} />
      <directionalLight color={colors.crema} intensity={0.9} position={[-4, 10, 8]} />
      <group ref={root}>
        {floors.map((floor) => (
          <Floor
            key={floor.id}
            level={floor.number}
            rooms={floor.rooms ?? []}
            active={floor.id === activeFloorId}
            off={Boolean(floor.off)}
            top={floor.number === topLevel}
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
