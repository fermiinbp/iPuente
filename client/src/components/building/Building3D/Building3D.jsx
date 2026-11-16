// Edificio 3D procedural del hero: muro cortina de vidrio con montantes, forjados, núcleo de comunicaciones,
// cubierta con máquinas y una plaza con árboles. Los botones HTML mandan: `activeFloorId` resalta una planta
// (forjado lima y estados de sala visibles a través del vidrio) y `selectedFloorId` la abre: las de encima suben
// y se desvanecen. Cámara 3/4 con OrbitControls; render bajo demanda (invalidate solo mientras algo se mueve).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import LazyCanvas from '@/components/three/LazyCanvas/LazyCanvas.jsx';
import { useCssColors } from '@/hooks/useCssColors.js';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import {
  BASE_Y,
  CORE,
  LIFT,
  ROOF_T,
  TREES,
  buildInterior,
  buildingHeight,
  canopyGeometry,
  coreGeometry,
  coreWindowGeometry,
  facadeMatrices,
  furnitureMatrices,
  fitCamera,
  hvacGrilleMatrices,
  hvacMatrices,
  layoutFloors,
  plateGeometry,
  plazaGeometry,
  railGeometry,
  roofGeometry,
  skylightMatrix,
  streetFurnitureGeometry,
  terraceDeckGeometry,
  terraceGeometry,
  terraceRailGeometry,
  FULL_PLAN,
  SETBACK_PLAN,
} from './building3dModel.js';
import styles from './Building3D.module.css';

// Colores: solo tokens de :root.
const TOKENS = [
  'crema',
  'crema-suave',
  'bosque-elevado',
  'bosque-profundo',
  'foto-hueco',
  'linea',
  'linea-plano',
  'lima',
  'libre',
  'ocupada',
  'no-alquila',
  'trama-no-alquila',
  'bronce',
  'bronce-claro',
];

const CAMERA = { fov: 30, near: 1, far: 400, position: [60, 40, 90] };
const AZIMUTH = 0.62; // 3/4: unos 35° desde el frente
const ELEVATION = 0.34; // ligeramente picada (~19°)
const KEY_STEP = 0.15; // radianes por pulsación de flecha
const NO_RAYCAST = () => null;
const UP = new Vector3(0, 1, 0);
const EXPOSURE = 1;
const GLASS_OPACITY = 0.35;
const GLASS_OPACITY_GROUND = 0.22; // vestíbulo más transparente
const GLASS_OPACITY_OPEN = 0.14; // la planta abierta se ve casi sin vidrio

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

// Geometrías y materiales base: se crean una vez y cada planta los comparte (los materiales se clonan por planta
// para poder desvanecerlas una a una).
function crearRecursos(colors) {
  const palette = {
    free: colors.libre,
    busy: colors.ocupada,
    off: colors['no-alquila'],
    floorNeutral: colors['crema-suave'].clone().multiplyScalar(0.55),
    wallNeutral: colors['crema-suave'].clone().multiplyScalar(0.85),
    bronce: colors.bronce,
    door: colors['bosque-profundo'],
    plaza: colors['bosque-elevado'],
    sidewalk: colors.linea,
  };
  const trama = crearTrama(colors['no-alquila'], colors['trama-no-alquila']);
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const glass = () =>
    new MeshPhysicalMaterial({
      color: colors.libre,
      transparent: true,
      opacity: GLASS_OPACITY,
      roughness: 0.05,
      metalness: 0,
      envMapIntensity: 2,
      depthWrite: false,
    });
  const cores = new Map();
  const coreWins = new Map();
  const terraces = new Map();
  return {
    palette,
    trama,
    unit: new BoxGeometry(1, 1, 1),
    plates: { full: plateGeometry(FULL_PLAN), setback: plateGeometry(SETBACK_PLAN) },
    roofs: { full: roofGeometry(FULL_PLAN), setback: roofGeometry(SETBACK_PLAN) },
    core: (height) => {
      if (!cores.has(height)) cores.set(height, coreGeometry(height));
      return cores.get(height);
    },
    cores,
    coreWin: (height) => {
      if (!coreWins.has(height)) coreWins.set(height, coreWindowGeometry(height));
      return coreWins.get(height);
    },
    coreWins,
    terrace: (plan, upper) => {
      const key = `${plan.cx}|${plan.cz}|${plan.w}|${plan.d}>${upper.cx}|${upper.cz}|${upper.w}|${upper.d}`;
      if (!terraces.has(key)) {
        terraces.set(key, {
          slab: terraceGeometry(plan, upper),
          deck: terraceDeckGeometry(plan, upper),
          rail: terraceRailGeometry(plan, upper),
        });
      }
      return terraces.get(key);
    },
    terraces,
    rails: { full: railGeometry(FULL_PLAN), setback: railGeometry(SETBACK_PLAN) },
    furniture: streetFurnitureGeometry(palette),
    canopy: canopyGeometry(palette),
    plaza: plazaGeometry(palette),
    trunk: new CylinderGeometry(0.14, 0.2, 1.4, 6),
    crown: new IcosahedronGeometry(1.5, 0),
    mats: {
      plate: std(colors.linea, 0.7, 0),
      glass: glass(),
      mullion: std(colors['bosque-profundo'], 0.6, 0.1),
      dark: std(colors['bosque-profundo'], 0.7, 0.1),
      furniture: std(colors['crema-suave'].clone().multiplyScalar(0.72), 0.85, 0),
      band: std(colors.linea.clone().multiplyScalar(0.82), 0.8, 0),
      core: std(colors['foto-hueco'], 0.7),
      rooms: std(0xffffff, 0.85, 0, {
        vertexColors: true,
        toneMapped: false,
        envMapIntensity: 0.35,
      }),
      hatch: std(0xffffff, 0.9, 0, { map: trama, toneMapped: false, envMapIntensity: 0.35 }),
      roof: std(colors.linea, 0.75, 0),
      // Terraza: el tono siguiente más oscuro que la cubierta, mezclando tokens.
      terrace: std(colors.linea.clone().lerp(colors['bosque-elevado'], 0.65), 0.85, 0),
      hvac: std(colors['no-alquila'], 0.7, 0.1),
      sky: glass(),
      canopy: std(0xffffff, 0.65, 0.05, { vertexColors: true }),
      plaza: std(0xffffff, 0.95, 0, { vertexColors: true }),
      trunk: std(colors.bronce.clone().multiplyScalar(0.6), 0.9),
      crown: std(colors['linea-plano'].clone().lerp(colors.libre, 0.35), 0.85, 0, {
        flatShading: true,
      }),
    },
  };
}

function disposeResources(r) {
  r.trama.dispose();
  r.unit.dispose();
  Object.values(r.plates).forEach((g) => g.dispose());
  Object.values(r.roofs).forEach((g) => g.dispose());
  r.cores.forEach((g) => g.dispose());
  r.coreWins.forEach((g) => g.dispose());
  r.terraces.forEach((t) => {
    t.slab.dispose();
    t.deck.dispose();
    t.rail.dispose();
  });
  Object.values(r.rails).forEach((g) => g.dispose());
  r.furniture.dispose();
  r.canopy.dispose();
  r.plaza.dispose();
  r.trunk.dispose();
  r.crown.dispose();
  Object.values(r.mats).forEach((m) => m.dispose());
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
  const mats = useMemo(
    () => ({
      roof: resources.mats.roof.clone(),
      hvac: resources.mats.hvac.clone(),
      sky: resources.mats.sky.clone(),
      dark: resources.mats.dark.clone(),
    }),
    [resources],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const fades = useMemo(
    () => [
      [mats.roof, 1],
      [mats.hvac, 1],
      [mats.dark, 1],
      [mats.sky, GLASS_OPACITY, true],
    ],
    [mats],
  );
  useFade(group, fades, hidden ? 0 : 1, reduced);
  const hvac = useMemo(() => hvacMatrices(plan), [plan]);
  const grille = useMemo(() => hvacGrilleMatrices(plan), [plan]);
  const sky = useMemo(() => skylightMatrix(plan), [plan]);
  const grilleRef = useRef(null);
  const skyRef = useRef(null);

  useLayoutEffect(() => {
    hvac.forEach((m, i) => hvacRef.current.setMatrixAt(i, m));
    hvacRef.current.instanceMatrix.needsUpdate = true;
    hvacRef.current.computeBoundingSphere();
    grille.forEach((m, i) => grilleRef.current.setMatrixAt(i, m));
    grilleRef.current.instanceMatrix.needsUpdate = true;
    grilleRef.current.computeBoundingSphere();
    skyRef.current.setMatrixAt(0, sky);
    skyRef.current.instanceMatrix.needsUpdate = true;
    skyRef.current.computeBoundingSphere();
  }, [hvac, grille, sky]);

  return (
    <group ref={group} position={[0, h, 0]}>
      <mesh
        geometry={plan === FULL_PLAN ? resources.roofs.full : resources.roofs.setback}
        material={mats.roof}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={hvacRef}
        args={[resources.unit, mats.hvac, hvac.length]}
        castShadow
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={grilleRef}
        args={[resources.unit, mats.dark, grille.length]}
        raycast={NO_RAYCAST}
      />
      <mesh
        geometry={plan === FULL_PLAN ? resources.rails.full : resources.rails.setback}
        material={mats.dark}
        castShadow
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={skyRef}
        args={[resources.unit, mats.sky, 1]}
        renderOrder={2}
        raycast={NO_RAYCAST}
      />
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
}) {
  const { floor, y0, h, plan, isTop, upperPlan } = entry;
  const invalidate = useThree((state) => state.invalidate);
  const group = useRef(null);
  const panesRef = useRef(null);
  const mullionsRef = useRef(null);
  const bandsRef = useRef(null);
  const furnitureRef = useRef(null);
  const lift = useRef(0);
  const above = selectedLevel !== null && floor.number > selectedLevel;
  const targetLift = above ? LIFT : 0;

  const mats = useMemo(
    () => ({
      plate: resources.mats.plate.clone(),
      glass: resources.mats.glass.clone(),
      mullion: resources.mats.mullion.clone(),
      band: resources.mats.band.clone(),
      furniture: resources.mats.furniture.clone(),
      roof: resources.mats.roof.clone(),
      terrace: resources.mats.terrace.clone(),
      dark: resources.mats.dark.clone(),
      core: resources.mats.core.clone(),
      rooms: resources.mats.rooms.clone(),
      hatch: resources.mats.hatch.clone(),
    }),
    [resources],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const glassBase = selected
    ? GLASS_OPACITY_OPEN
    : floor.off
      ? GLASS_OPACITY_GROUND
      : GLASS_OPACITY;
  const fades = useMemo(
    () => [
      [mats.plate, 1],
      [mats.mullion, 1],
      [mats.band, 1],
      [mats.roof, 1],
      [mats.furniture, 1],
      [mats.terrace, 1],
      [mats.dark, 1],
      [mats.core, 1],
      [mats.rooms, 1],
      [mats.hatch, 1],
      [mats.glass, glassBase, true],
    ],
    [mats, glassBase],
  );
  useFade(group, fades, above ? 0 : 1, reduced);

  const interior = useMemo(
    () => buildInterior(plan, floor, resources.palette),
    [plan, floor, resources],
  );
  useEffect(
    () => () => {
      interior.geometry?.dispose();
      interior.hatch?.dispose();
    },
    [interior],
  );
  const furniture = useMemo(() => furnitureMatrices(plan, floor), [plan, floor]);
  const facade = useMemo(() => facadeMatrices(plan, h, !!floor.off), [plan, h, floor.off]);
  const coreHeight = isTop ? h + ROOF_T + CORE.cap : h;
  const terrace = upperPlan && upperPlan !== plan ? resources.terrace(plan, upperPlan) : null;
  const plateGeo = plan === FULL_PLAN ? resources.plates.full : resources.plates.setback;

  // Matrices de las instancias de la fachada.
  useLayoutEffect(() => {
    const fill = (mesh, matrices) => {
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    fill(panesRef.current, facade.panes);
    fill(mullionsRef.current, facade.mullions);
    fill(bandsRef.current, facade.bands);
    invalidate();
  }, [facade, invalidate]);

  // Mesas y sillas de las salas.
  useLayoutEffect(() => {
    const mesh = furnitureRef.current;
    if (!mesh) return;
    furniture.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [furniture, invalidate]);

  // Planta resaltada: forjado lima y colores de estado en suelo y tabiques; el resto, interior neutro.
  useLayoutEffect(() => {
    mats.plate.color.copy(active ? colors.lima : colors.linea);
    const attr = interior.geometry?.getAttribute('color');
    if (attr) {
      attr.array.set(active ? interior.state : interior.neutral);
      attr.needsUpdate = true;
    }
    invalidate();
  }, [active, mats, colors, interior, invalidate]);

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

  const interactive = !above;
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
      <mesh geometry={plateGeo} material={mats.plate} castShadow receiveShadow />
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
      <instancedMesh
        ref={bandsRef}
        args={[resources.unit, mats.band, facade.bands.length]}
        castShadow
        receiveShadow
      />
      {furniture.length > 0 && (
        <instancedMesh
          ref={furnitureRef}
          args={[resources.unit, mats.furniture, furniture.length]}
          castShadow
          raycast={NO_RAYCAST}
        />
      )}
      {interior.geometry && <mesh geometry={interior.geometry} material={mats.rooms} />}
      {interior.hatch && <mesh geometry={interior.hatch} material={mats.hatch} visible={active} />}
      <mesh geometry={resources.core(coreHeight)} material={mats.core} castShadow receiveShadow />
      <mesh geometry={resources.coreWin(h)} material={mats.dark} raycast={NO_RAYCAST} />
      {terrace && (
        <group position={[0, h, 0]}>
          <mesh geometry={terrace.slab} material={mats.roof} castShadow receiveShadow />
          <mesh
            geometry={terrace.deck}
            material={mats.terrace}
            receiveShadow
            raycast={NO_RAYCAST}
          />
          <mesh geometry={terrace.rail} material={mats.dark} castShadow raycast={NO_RAYCAST} />
        </group>
      )}
      {floor.off && (
        <mesh
          geometry={resources.canopy}
          material={resources.mats.canopy}
          castShadow
          raycast={NO_RAYCAST}
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

function Trees({ resources }) {
  const trunks = useRef(null);
  const crowns = useRef(null);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    TREES.forEach(([x, z, s], i) => {
      dummy.rotation.set(0, i * 1.7, 0);
      dummy.position.set(x, BASE_Y - 0.08 + 0.7 * s, z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunks.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, BASE_Y - 0.08 + 1.4 * s + 1.1 * s, z);
      dummy.scale.set(s, s * 1.2, s);
      dummy.updateMatrix();
      crowns.current.setMatrixAt(i, dummy.matrix);
    });
    for (const mesh of [trunks.current, crowns.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);
  return (
    <>
      <instancedMesh
        ref={trunks}
        args={[resources.trunk, resources.mats.trunk, TREES.length]}
        castShadow
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={crowns}
        args={[resources.crown, resources.mats.crown, TREES.length]}
        castShadow
        raycast={NO_RAYCAST}
      />
    </>
  );
}

function Scene({
  floors,
  activeFloorId,
  selectedFloorId,
  onHoverFloor,
  onSelectFloor,
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

  const getState = useThree((state) => state.get);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const controls = useRef(null);
  const framed = useRef(false);

  const { distance, target } = useMemo(
    () =>
      fitCamera({
        width,
        height,
        fovDeg: CAMERA.fov,
        azimuth: AZIMUTH,
        elevation: ELEVATION,
        target: new Vector3(1.2, total * 0.47, 0.8),
        layout,
      }),
    [width, height, total, layout],
  );

  // Exposición baja para que el lima y el crema no se quemen con ACES.
  useLayoutEffect(() => {
    getState().gl.toneMappingExposure = EXPOSURE;
    invalidate();
  }, [getState, invalidate]);

  // Encuadre: la primera vez, el 3/4 inicial; al cambiar el tamaño se conserva el ángulo al que el usuario giró.
  useLayoutEffect(() => {
    const dir = new Vector3();
    if (framed.current) {
      dir.subVectors(camera.position, target).normalize();
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
      <Environment resolution={256} frames={1} environmentIntensity={0.75}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color={colors.crema}
          position={[0, 12, -4]}
          rotation-x={Math.PI / 2}
          scale={[24, 24, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color={colors.crema}
          position={[-14, 5, 8]}
          rotation-y={Math.PI / 2}
          scale={[18, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          color={colors['crema-suave']}
          position={[14, 3, -8]}
          rotation-y={-Math.PI / 2}
          scale={[18, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color={colors['crema-suave']}
          position={[0, 3, 16]}
          rotation-y={Math.PI}
          scale={[24, 5, 1]}
        />
      </Environment>
      <directionalLight
        castShadow
        color={colors.crema.clone().lerp(colors['bronce-claro'], 0.18)}
        intensity={2.4}
        position={[-16, 30, 20]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={5}
        shadow-camera-far={90}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
        shadow-radius={4}
      />
      {/* Relleno frío, sin sombra, desde el lado contrario al sol: el tono más fresco de la paleta. */}
      <directionalLight color={colors['crema-suave']} intensity={0.95} position={[30, 10, 6]} />
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
        minDistance={distance * 0.55}
        maxDistance={distance * 1.25}
      />

      <mesh geometry={resources.plaza} material={resources.mats.plaza} receiveShadow />
      <Trees resources={resources} />
      <mesh
        geometry={resources.furniture}
        material={resources.mats.canopy}
        castShadow
        raycast={NO_RAYCAST}
      />
      <ContactShadows
        position={[0, BASE_Y + 0.01, 0]}
        scale={46}
        far={14}
        blur={2.4}
        opacity={0.55}
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
        />
      ))}
    </>
  );
}

export default function Building3D({
  floors,
  activeFloorId,
  selectedFloorId,
  onHoverFloor,
  onSelectFloor,
  label,
  fallback = null,
}) {
  const reduced = useReducedMotion();
  const turnRef = useRef(null);
  // La rueda solo hace zoom con el contenedor enfocado: si no, el edificio atraparía el scroll de la página.
  const [zoom, setZoom] = useState(false);
  const onKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    turnRef.current?.(event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP);
  };
  return (
    <div
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
          reduced={reduced}
          turnRef={turnRef}
          zoom={zoom}
        />
      </LazyCanvas>
    </div>
  );
}
