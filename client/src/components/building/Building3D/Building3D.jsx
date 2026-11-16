// Edificio 3D procedural del hero, fiel al mockup: 5 plantas iguales con forjados finos y seis bloques de sala por
// planta, más una fachada de vidrio sutil (montantes finos) y una cubierta con peto, dos máquinas y una caseta.
// Los botones HTML mandan: `activeFloorId` resalta una planta (forjado lima y colores de estado a través del vidrio)
// y `selectedFloorId` la abre como en el mockup: las de encima suben y se desvanecen, las de debajo se desvanecen y
// queda solo esa planta con sus salas planas en su color de estado, una etiqueta («2.01 · Libre») por sala y la
// ficha de la sala elegida (contorno lima). Cámara 3/4 con OrbitControls; render bajo demanda.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import LazyCanvas from '@/components/three/LazyCanvas/LazyCanvas.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { useCssColors } from '@/hooks/useCssColors.js';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import {
  FULL_PLAN,
  LIFT,
  STATUS_LABEL,
  buildBlocks,
  buildOpenRooms,
  buildingHeight,
  facadeMatrices,
  fitView,
  layoutFloors,
  plateGeometry,
  roofBoxMatrices,
  roofGeometry,
  roomCode,
  roomOutlineGeometry,
} from './building3dModel.js';
import styles from './Building3D.module.css';

// Colores: solo tokens de :root.
const TOKENS = [
  'crema',
  'crema-suave',
  'bosque',
  'bosque-elevado',
  'bosque-profundo',
  'linea-plano',
  'lima',
  'libre',
  'ocupada',
  'no-alquila',
  'trama-no-alquila',
];

const CAMERA = { fov: 30, near: 1, far: 500, position: [60, 40, 90] };
const AZIMUTH = (66 * Math.PI) / 180; // el lado largo queda a la izquierda, como en el mockup (~24° del lado corto)
const ELEVATION = (35 * Math.PI) / 180; // picada del mockup
const FILL_H = 0.7; // el edificio ocupa el 70 % del alto del canvas…
const FILL_W = 0.8; // …y como mucho el 80 % del ancho (no se sale de la columna del hero)
const KEY_STEP = 0.15; // radianes por pulsación de flecha
const NO_RAYCAST = () => null;
const UP = new Vector3(0, 1, 0);
const GLASS_OPACITY = 0.12; // muy poca: deja ver los bloques y no tapa el color de estado
const STATUS_BADGE = { free: 'free', busy: 'occupied', off: 'off' };

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
  return textura;
}

// Geometrías y materiales base: se crean una vez y cada planta los comparte (los materiales de la cáscara se
// clonan por planta para poder desvanecerlas una a una).
function crearRecursos(colors) {
  const palette = {
    free: colors.libre,
    busy: colors.ocupada,
    off: colors['no-alquila'],
    block: colors.libre.clone().multiplyScalar(0.97),
  };
  const slab = colors.libre.clone().multiplyScalar(0.88);
  const trama = crearTrama(colors['no-alquila'], colors['trama-no-alquila']);
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new MeshStandardMaterial({ color, roughness, metalness, ...extra });
  // Salas planas de la planta abierta, como en el mockup: color plano y sin tone mapping, para que el estado sea el del token.
  const tile = (color) => new MeshBasicMaterial({ color, toneMapped: false });
  return {
    palette,
    slabColor: slab,
    trama,
    unit: new BoxGeometry(1, 1, 1),
    plate: plateGeometry(FULL_PLAN),
    roof: roofGeometry(FULL_PLAN),
    mats: {
      plate: std(slab, 0.8),
      glass: new MeshPhysicalMaterial({
        color: colors.libre,
        transparent: true,
        opacity: GLASS_OPACITY,
        roughness: 0.05,
        metalness: 0,
        envMapIntensity: 1,
        depthWrite: false,
      }),
      mullion: std(colors['linea-plano'], 0.6, 0.1),
      blocks: std(0xffffff, 0.85, 0, {
        vertexColors: true,
        toneMapped: false,
        envMapIntensity: 0.35,
      }),
      hatch: new MeshBasicMaterial({ map: trama, toneMapped: false }),
      tiles: { free: tile(colors.libre), busy: tile(colors.ocupada), off: tile(colors['no-alquila']) },
      outline: new MeshBasicMaterial({ color: colors.lima, toneMapped: false }),
      roof: std(slab.clone().multiplyScalar(0.95), 0.7),
      hvac: std(colors['no-alquila'], 0.6, 0.3),
      hut: std(colors['crema-suave'].clone().multiplyScalar(0.8), 0.75),
    },
  };
}

function disposeResources(r) {
  r.trama.dispose();
  r.unit.dispose();
  r.plate.dispose();
  r.roof.dispose();
  const { tiles, ...rest } = r.mats;
  Object.values(rest).forEach((m) => m.dispose());
  Object.values(tiles).forEach((m) => m.dispose());
}

// Desvanece un grupo de materiales hacia `target` (0 a 1). El flag `transparent` solo cambia al empezar y al
// terminar de desvanecer, porque three recompila el shader al cambiarlo.
function applyFade(group, fades, value) {
  for (const [material, base, isGlass] of fades) {
    const o = base * value;
    material.opacity = o;
    const transparent = isGlass || o < 0.999;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.depthWrite = !isGlass && o > 0.99;
  }
  if (group) group.visible = value > 0.01;
}

function useFade(groupRef, fades, target, reduced) {
  const invalidate = useThree((state) => state.invalidate);
  const op = useRef(target);
  const apply = (value) => applyFade(groupRef.current, fades, value);

  useLayoutEffect(() => {
    applyFade(groupRef.current, fades, op.current);
    invalidate();
  }, [groupRef, fades, invalidate]);

  useEffect(() => {
    invalidate();
  }, [target, invalidate]);

  useFrame((_, delta) => {
    const diff = target - op.current;
    if (Math.abs(diff) < 0.01 || reduced) {
      if (op.current !== target) {
        op.current = target;
        apply(target);
      }
      return;
    }
    op.current += diff * Math.min(1, delta * 9);
    apply(op.current);
    invalidate();
  });

  return op;
}

function Roof({ entry, hidden, resources, reduced }) {
  const { plan, h } = entry;
  const group = useRef(null);
  const hvacRef = useRef(null);
  const hutRef = useRef(null);
  const mats = useMemo(
    () => ({
      roof: resources.mats.roof.clone(),
      hvac: resources.mats.hvac.clone(),
      hut: resources.mats.hut.clone(),
    }),
    [resources],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const fades = useMemo(
    () => [
      [mats.roof, 1],
      [mats.hvac, 1],
      [mats.hut, 1],
    ],
    [mats],
  );
  useFade(group, fades, hidden ? 0 : 1, reduced);
  const boxes = useMemo(() => roofBoxMatrices(plan), [plan]);

  useLayoutEffect(() => {
    boxes.hvac.forEach((m, i) => hvacRef.current.setMatrixAt(i, m));
    hvacRef.current.instanceMatrix.needsUpdate = true;
    hvacRef.current.computeBoundingSphere();
    hutRef.current.setMatrixAt(0, boxes.hut);
    hutRef.current.instanceMatrix.needsUpdate = true;
    hutRef.current.computeBoundingSphere();
  }, [boxes]);

  return (
    <group ref={group} position={[0, h, 0]}>
      <mesh geometry={resources.roof} material={mats.roof} castShadow receiveShadow />
      <instancedMesh
        ref={hvacRef}
        args={[resources.unit, mats.hvac, boxes.hvac.length]}
        castShadow
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={hutRef}
        args={[resources.unit, mats.hut, 1]}
        castShadow
        raycast={NO_RAYCAST}
      />
    </group>
  );
}

// Planta abierta (como el mockup): salas planas en su color de estado, una etiqueta por sala y la elegida en lima.
function OpenRooms({ floor, plan, resources, roomIndex, onRoom, portal }) {
  const open = useMemo(() => buildOpenRooms(plan, floor), [plan, floor]);
  useEffect(() => () => open.hatch?.dispose(), [open]);
  const chosen = open.rooms.find((room) => room.index === roomIndex);
  const outline = useMemo(() => (chosen ? roomOutlineGeometry(chosen) : null), [chosen]);
  useEffect(() => () => outline?.dispose(), [outline]);

  return (
    <group>
      {open.rooms.map((room) => (
        <mesh
          key={room.index}
          geometry={resources.unit}
          material={resources.mats.tiles[room.status] ?? resources.mats.tiles.off}
          position={[room.x, room.y, room.z]}
          scale={[room.w, open.tileT, room.d]}
          receiveShadow
          onPointerOver={(event) => {
            event.stopPropagation();
            event.nativeEvent.target.style.cursor = 'pointer';
          }}
          onPointerOut={(event) => {
            event.nativeEvent.target.style.cursor = '';
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta > 6) return; // era un arrastre para girar
            onRoom(room.index === roomIndex ? null : room.index);
          }}
        />
      ))}
      {open.hatch && (
        <mesh geometry={open.hatch} material={resources.mats.hatch} raycast={NO_RAYCAST} />
      )}
      {outline && <mesh geometry={outline} material={resources.mats.outline} raycast={NO_RAYCAST} />}
      {open.rooms.map((room) => (
        <Html
          key={room.index}
          position={[room.x, room.top, room.z]}
          portal={portal}
          zIndexRange={[30, 0]}
          className={styles.etiquetaRaiz}
        >
          <button
            type="button"
            className={`${styles.etiqueta} ${styles[`etiqueta_${room.status}`] ?? ''}`}
            aria-pressed={room.index === roomIndex}
            onClick={() => onRoom(room.index === roomIndex ? null : room.index)}
          >
            {roomCode(floor, room.index)} · {STATUS_LABEL[room.status] ?? STATUS_LABEL.off}
          </button>
          <span className={styles.tallo} aria-hidden="true" />
        </Html>
      ))}
    </group>
  );
}

function Floor({
  entry,
  active,
  selected,
  selectedLevel,
  resources,
  colors,
  reduced,
  onHover,
  onSelect,
  roomIndex,
  onRoom,
  portal,
}) {
  const { floor, y0, h, plan, isTop } = entry;
  const invalidate = useThree((state) => state.invalidate);
  const group = useRef(null);
  const panesRef = useRef(null);
  const mullionsRef = useRef(null);
  const lift = useRef(0);
  const above = selectedLevel !== null && floor.number > selectedLevel;
  const below = selectedLevel !== null && floor.number < selectedLevel;
  const targetLift = above ? LIFT : 0;

  const mats = useMemo(
    () => ({
      plate: resources.mats.plate.clone(),
      glass: resources.mats.glass.clone(),
      mullion: resources.mats.mullion.clone(),
      blocks: resources.mats.blocks.clone(),
    }),
    [resources],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const fades = useMemo(
    () => [
      [mats.plate, 1],
      [mats.mullion, 1],
      [mats.blocks, 1],
      [mats.glass, GLASS_OPACITY, true],
    ],
    [mats],
  );
  useFade(group, fades, above || below ? 0 : 1, reduced);

  const blocks = useMemo(
    () => buildBlocks(plan, floor, resources.palette),
    [plan, floor, resources],
  );
  useEffect(() => () => blocks.geometry?.dispose(), [blocks]);
  const facade = useMemo(() => facadeMatrices(plan, h), [plan, h]);

  // Matrices de las instancias de la fachada.
  useLayoutEffect(() => {
    const fill = (mesh, matrices) => {
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    fill(panesRef.current, facade.panes);
    fill(mullionsRef.current, facade.mullions);
    invalidate();
  }, [facade, invalidate]);

  // Forjado: lima si la planta está resaltada, verde bosque oscuro si está abierta. Los bloques pasan al color de
  // estado a través del vidrio solo en la planta resaltada.
  useLayoutEffect(() => {
    mats.plate.color.copy(
      selected ? colors['bosque-elevado'] : active ? colors.lima : resources.slabColor,
    );
    const attr = blocks.geometry?.getAttribute('color');
    if (attr) {
      attr.array.set(active ? blocks.state : blocks.neutral);
      attr.needsUpdate = true;
    }
    invalidate();
  }, [active, selected, mats, colors, resources, blocks, invalidate]);

  // Posición: las plantas de encima de la abierta suben (con movimiento reducido, saltan).
  useLayoutEffect(() => {
    lift.current = targetLift;
    if (group.current) group.current.position.y = y0 + targetLift;
    // Solo al montar: después anima useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    invalidate();
  }, [targetLift, invalidate]);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const diff = targetLift - lift.current;
    if (reduced || Math.abs(diff) < 0.005) {
      lift.current = targetLift;
    } else {
      lift.current += diff * Math.min(1, delta * 8);
      invalidate();
    }
    g.position.y = y0 + lift.current;
  });

  const interactive = !above && !below;
  const handlers = interactive
    ? {
        onPointerOver: (event) => {
          event.stopPropagation();
          if (event.nativeEvent.pointerType === 'mouse') onHover?.(floor.id);
          event.nativeEvent.target.style.cursor = 'pointer';
        },
        onPointerOut: (event) => {
          event.nativeEvent.target.style.cursor = '';
        },
        onClick: (event) => {
          event.stopPropagation();
          if (event.delta > 6) return; // era un arrastre para girar, no un clic
          onSelect?.(floor.id);
        },
      }
    : {};

  return (
    <group ref={group} {...handlers}>
      <mesh geometry={resources.plate} material={mats.plate} castShadow receiveShadow />
      <group visible={!selected}>
        <instancedMesh
          ref={panesRef}
          args={[resources.unit, mats.glass, facade.panes.length]}
          renderOrder={2}
        />
        <instancedMesh
          ref={mullionsRef}
          args={[resources.unit, mats.mullion, facade.mullions.length]}
          raycast={NO_RAYCAST}
        />
        {blocks.geometry && (
          <mesh geometry={blocks.geometry} material={mats.blocks} castShadow receiveShadow />
        )}
      </group>
      {selected && (
        <OpenRooms
          floor={floor}
          plan={plan}
          resources={resources}
          roomIndex={roomIndex}
          onRoom={onRoom}
          portal={portal}
        />
      )}
      {isTop && (
        <Roof
          entry={entry}
          hidden={selectedLevel !== null}
          resources={resources}
          reduced={reduced}
        />
      )}
    </group>
  );
}

function Scene({
  floors,
  activeFloorId,
  selectedFloorId,
  onHoverFloor,
  onSelectFloor,
  roomIndex,
  onRoom,
  portal,
  reduced,
  turnRef,
  zoom,
}) {
  const colors = useCssColors(TOKENS);
  const resources = useMemo(() => crearRecursos(colors), [colors]);
  useEffect(() => () => disposeResources(resources), [resources]);

  const layout = useMemo(() => layoutFloors(floors), [floors]);
  const total = buildingHeight(layout);
  const selectedEntry = layout.find((entry) => entry.floor.id === selectedFloorId);
  const selectedLevel = selectedEntry ? selectedEntry.floor.number : null;

  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const controls = useRef(null);
  const framed = useRef(false);

  // Dos encuadres: el edificio entero (70 % del alto) y, con una planta abierta, solo esa planta.
  const closedView = useMemo(
    () =>
      fitView({
        aspect: height > 0 ? width / height : 1.4,
        fovDeg: CAMERA.fov,
        azimuth: AZIMUTH,
        elevation: ELEVATION,
        plan: FULL_PLAN,
        height: total,
        fracH: FILL_H,
        fracW: FILL_W,
      }),
    [width, height, total],
  );
  const selectedY = selectedEntry ? selectedEntry.y0 : null;
  const openView = useMemo(
    () =>
      selectedY === null
        ? null
        : fitView({
            aspect: height > 0 ? width / height : 1.4,
            fovDeg: CAMERA.fov,
            azimuth: AZIMUTH,
            elevation: ELEVATION,
            plan: FULL_PLAN,
            height: total,
            fracH: FILL_H,
            fracW: FILL_W,
            floorY: selectedY,
          }),
    [width, height, total, selectedY],
  );
  const { target, distance } = closedView;
  const goal = useRef(closedView);
  useLayoutEffect(() => {
    goal.current = openView ?? closedView;
    invalidate();
  }, [openView, closedView, invalidate]);

  // Al abrir o cerrar una planta la cámara se acerca o se aleja suavemente conservando el ángulo al que se giró.
  const dirTmp = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const g = goal.current;
    const current = camera.position.distanceTo(c.target);
    if (c.target.distanceTo(g.target) < 0.02 && Math.abs(current - g.distance) < 0.02) return;
    const k = reduced ? 1 : Math.min(1, delta * 6);
    dirTmp.subVectors(camera.position, c.target).normalize();
    c.target.lerp(g.target, k);
    camera.position.copy(c.target).addScaledVector(dirTmp, current + (g.distance - current) * k);
    c.update();
    invalidate();
  });

  // Encuadre: la primera vez, el 3/4 inicial; al cambiar el tamaño se conserva el ángulo al que el usuario giró.
  useLayoutEffect(() => {
    const dir = new Vector3();
    if (framed.current) {
      dir.subVectors(camera.position, controls.current?.target ?? target).normalize();
    } else {
      dir.set(
        Math.cos(ELEVATION) * Math.sin(AZIMUTH),
        Math.sin(ELEVATION),
        Math.cos(ELEVATION) * Math.cos(AZIMUTH),
      );
      framed.current = true;
    }
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.current?.update();
    invalidate();
  }, [camera, target, distance, invalidate]);

  // Giro con el teclado (flechas del contenedor): un paso fijo alrededor del edificio.
  useEffect(() => {
    turnRef.current = (step) => {
      const offset = camera.position.clone().sub(target).applyAxisAngle(UP, step);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls.current?.update();
      invalidate();
    };
    return () => {
      turnRef.current = null;
    };
  }, [turnRef, camera, target, invalidate]);

  return (
    <>
      {/* Reflejos del vidrio: luces rectangulares en vez de un HDR descargado, así no hay petición externa. */}
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color={colors.crema}
          position={[0, 14, -4]}
          rotation-x={Math.PI / 2}
          scale={[30, 30, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color={colors.crema}
          position={[-16, 6, 8]}
          rotation-y={Math.PI / 2}
          scale={[22, 12, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          color={colors['crema-suave']}
          position={[16, 4, -8]}
          rotation-y={-Math.PI / 2}
          scale={[22, 10, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color={colors['crema-suave']}
          position={[0, 4, 18]}
          rotation-y={Math.PI}
          scale={[28, 8, 1]}
        />
      </Environment>
      <directionalLight
        castShadow
        color={colors.crema}
        intensity={2.6}
        position={[-18, 40, 26]}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={5}
        shadow-camera-far={110}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
        shadow-radius={4}
      />
      <OrbitControls
        ref={controls}
        target={target}
        enablePan={false}
        enableZoom={zoom}
        enableDamping={!reduced}
        dampingFactor={0.08}
        rotateSpeed={0.7}
        minPolarAngle={0.55}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={Math.min(distance, openView?.distance ?? distance) * 0.55}
        maxDistance={distance * 1.25}
      />

      {/* Sombra suave de la luz sobre el suelo (invisible salvo la sombra) y sombra de contacto en la base. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.005, 0]}
        visible={selectedLevel === null}
        receiveShadow
        raycast={NO_RAYCAST}
      >
        <planeGeometry args={[80, 80]} />
        <shadowMaterial opacity={0.12} color={colors['bosque-profundo']} />
      </mesh>
      <ContactShadows
        visible={selectedLevel === null}
        position={[0, 0.02, 0]}
        scale={44}
        far={total + 4}
        blur={2.6}
        opacity={0.5}
        resolution={512}
        color={colors['bosque-profundo']}
      />

      {layout.map((entry) => (
        <Floor
          key={entry.floor.id}
          entry={entry}
          active={entry.floor.id === activeFloorId}
          selected={entry.floor.id === selectedFloorId}
          selectedLevel={selectedLevel}
          resources={resources}
          colors={colors}
          reduced={reduced}
          onHover={onHoverFloor}
          onSelect={onSelectFloor}
          roomIndex={roomIndex}
          onRoom={onRoom}
          portal={portal}
        />
      ))}
    </>
  );
}

// Ficha de la sala elegida (arriba a la izquierda, como en el mockup). El enlace solo sale si el padre pasa `roomHref`.
function RoomCard({ floor, index, roomHref, onClose }) {
  const status = floor.rooms?.[index] ?? 'off';
  const code = roomCode(floor, index);
  const href = status === 'free' ? roomHref?.(floor, code) : null;
  return (
    <aside className={styles.ficha} aria-label={`Sala ${code}`}>
      <button type="button" className={styles.fichaCerrar} onClick={onClose}>
        <span className={styles.srOnly}>Cerrar la ficha de la sala {code}</span>
        <span aria-hidden="true">×</span>
      </button>
      <p className={styles.fichaPlanta}>{floor.name}</p>
      <p className={styles.fichaTitulo}>Sala {code}</p>
      <StatusBadge status={STATUS_BADGE[status] ?? 'off'} />
      {href && (
        <Link className={styles.fichaEnlace} to={href}>
          Ver huecos libres
        </Link>
      )}
    </aside>
  );
}

export default function Building3D({
  floors,
  activeFloorId,
  selectedFloorId,
  onHoverFloor,
  onSelectFloor,
  roomHref,
  label,
  fallback = null,
}) {
  const reduced = useReducedMotion();
  const turnRef = useRef(null);
  const raiz = useRef(null);
  // La rueda solo hace zoom con el contenedor enfocado: si no, el edificio atraparía el scroll de la página.
  const [zoom, setZoom] = useState(false);
  // Sala elegida en la planta abierta; solo vale para la planta con la que se eligió.
  const [room, setRoom] = useState({ floorId: '', index: null });
  const roomIndex = room.floorId === selectedFloorId ? room.index : null;
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId);
  const onRoom = (index) => setRoom({ floorId: selectedFloorId, index });

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    turnRef.current?.(event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP);
  };
  return (
    <div
      ref={raiz}
      className={styles.grupo}
      tabIndex={0}
      role="group"
      aria-label="Edificio en 3D. Gira con las flechas izquierda y derecha"
      onKeyDown={onKeyDown}
      onFocus={() => setZoom(true)}
      onBlur={() => setZoom(false)}
    >
      <LazyCanvas
        label={label}
        fallback={fallback}
        camera={CAMERA}
        shadows="percentage"
        className={styles.escena}
      >
        <Scene
          floors={floors}
          activeFloorId={activeFloorId}
          selectedFloorId={selectedFloorId}
          onHoverFloor={onHoverFloor}
          onSelectFloor={onSelectFloor}
          roomIndex={roomIndex}
          onRoom={onRoom}
          portal={raiz}
          reduced={reduced}
          turnRef={turnRef}
          zoom={zoom}
        />
      </LazyCanvas>
      {selectedFloor && roomIndex !== null && (
        <RoomCard
          floor={selectedFloor}
          index={roomIndex}
          roomHref={roomHref}
          onClose={() => onRoom(null)}
        />
      )}
    </div>
  );
}
