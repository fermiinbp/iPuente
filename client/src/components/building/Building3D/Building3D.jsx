// Edificio 3D procedural del hero: muro cortina de vidrio con montantes, forjados, núcleo de comunicaciones,
// cubierta con máquinas y una plaza con árboles. Los botones HTML mandan: `activeFloorId` resalta una planta
// (forjado lima y estados de sala visibles a través del vidrio) y `selectedFloorId` la abre: las de encima suben
// como un bloque y la planta abierta pierde fachada y techo. Cámara 3/4 con OrbitControls; render bajo demanda (invalidate solo mientras algo se mueve).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DataTexture,
  EquirectangularReflectionMapping,
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
const AUTO_SPEED = 1.5; // giro automático de OrbitControls: una vuelta en unos 40 s
const RESUME_MS = 3000; // tras arrastrar, el giro automático espera 3 s para reanudarse
const SPREAD = 0.2; // metros que sube cada planta por nivel cuando `openRef` vale 1 (la apertura del scroll)
const NO_RAYCAST = () => null;
const UP = new Vector3(0, 1, 0);
const ANCHOR_POINT = new Vector3();
const EXPOSURE = 1;
const GLASS_OPACITY = 0.35;
const GLASS_OPACITY_GROUND = 0.22; // vestíbulo más transparente
const COLOR_AMBIENTE_SALAS = 90; // gris (0-255) del ambiente de las salas
const DURATION = 450; // ms: despiece de plantas y encuadre de la cámara

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
  // Ambiente propio y muy tenue para suelos y tabiques de las salas: con el de la escena (0,75) el ambiente aclara
  // tanto la zona en sombra que la sombra del bloque levantado casi no se distingue.
  const roomEnv = new DataTexture(
    new Uint8Array([COLOR_AMBIENTE_SALAS, COLOR_AMBIENTE_SALAS, COLOR_AMBIENTE_SALAS, 255]),
    1,
    1,
  );
  roomEnv.mapping = EquirectangularReflectionMapping;
  roomEnv.colorSpace = SRGBColorSpace;
  roomEnv.needsUpdate = true;
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const glass = () =>
    new MeshPhysicalMaterial({
      color: colors['crema-suave'],
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
    roomEnv,
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
        envMap: roomEnv,
        envMapIntensity: 1,
      }),
      hatch: std(0xffffff, 0.9, 0, {
        map: trama,
        toneMapped: false,
        envMap: roomEnv,
        envMapIntensity: 1,
      }),
      roof: std(colors.linea, 0.75, 0),
      // Terraza: el tono siguiente más oscuro que la cubierta, mezclando tokens.
      terrace: std(colors.linea.clone().lerp(colors['bosque-elevado'], 0.65), 0.85, 0),
      hvac: std(colors['no-alquila'], 0.7, 0.1),
      sky: glass(),
      canopy: std(0xffffff, 0.65, 0.05, { vertexColors: true }),
      plaza: std(0xffffff, 0.95, 0, { vertexColors: true }),
      trunk: std(colors.bronce.clone().multiplyScalar(0.6), 0.9),
      // Copas en tonos albero y terracota (la plaza no es verde).
      crown: std(colors['bronce-claro'].clone().lerp(colors.bronce, 0.3), 0.85, 0, {
        flatShading: true,
      }),
    },
  };
}

function disposeResources(r) {
  r.trama.dispose();
  r.roomEnv.dispose();
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

// Desvanece un grupo de materiales hacia `value` (0 a 1). El flag `transparent` solo cambia al empezar y al
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

function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// Lleva un valor a `target` en DURATION ms con easing y llama a `apply` en cada fotograma. Si el objetivo cambia
// a mitad de camino, parte del valor actual: sin saltos ni parpadeos. Con movimiento reducido salta directo.
function useTween(target, reduced, apply) {
  const invalidate = useThree((state) => state.invalidate);
  const tween = useRef({ value: target, from: target, to: target, t0: 0 });
  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });

  useLayoutEffect(() => {
    apply(tween.current.value);
    invalidate();
  }, [apply, invalidate]);

  useLayoutEffect(() => {
    const t = tween.current;
    if (t.to === target) return;
    t.from = t.value;
    t.to = target;
    t.t0 = performance.now();
    if (reduced) {
      t.value = target;
      applyRef.current(target);
    }
    invalidate();
  }, [target, reduced, invalidate]);

  useFrame(() => {
    const t = tween.current;
    if (t.value === t.to) return;
    const p = Math.min(1, (performance.now() - t.t0) / DURATION);
    t.value = p >= 1 ? t.to : t.from + (t.to - t.from) * ease(p);
    apply(t.value);
    if (p < 1) invalidate();
  });
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
  const applyRoof = useCallback((value) => applyFade(group.current, fades, value), [fades]);
  useTween(hidden ? 0 : 1, reduced, applyRoof);
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
  openRef,
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
  const shell = useRef(null);
  const pillarsRef = useRef(null);
  const above = selectedLevel !== null && floor.number > selectedLevel;

  const mats = useMemo(
    () => ({
      plate: resources.mats.plate.clone(),
      glass: resources.mats.glass.clone(),
      mullion: resources.mats.mullion.clone(),
      band: resources.mats.band.clone(),
      pillar: resources.mats.band.clone(),
      rail: resources.mats.dark.clone(),
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

  const glassBase = floor.off ? GLASS_OPACITY_GROUND : GLASS_OPACITY;
  // Al abrir la planta se desvanece solo su envolvente (fachada y techo); la estructura se queda.
  const fades = useMemo(
    () => [
      [mats.mullion, 1],
      [mats.band, 1],
      [mats.roof, 1],
      [mats.terrace, 1],
      [mats.rail, 1],
      [mats.glass, glassBase, true],
    ],
    [mats, glassBase],
  );
  const applyShell = useCallback((value) => applyFade(shell.current, fades, value), [fades]);
  useTween(selected ? 0 : 1, reduced, applyShell);
  // Altura de la planta = base + subida al abrir otra planta + apertura del scroll (`openRef`, de 0 a 1).
  const liftRef = useRef(0);
  const spread = () => (openRef ? openRef.current * floor.number * SPREAD : 0);
  const applyLift = useCallback(
    (value) => {
      liftRef.current = value;
      if (group.current) {
        group.current.position.y = y0 + value + (openRef ? openRef.current * floor.number * SPREAD : 0);
      }
    },
    [y0, openRef, floor.number],
  );
  useTween(above ? LIFT : 0, reduced, applyLift);
  useFrame(() => {
    if (!openRef || !group.current) return;
    const y = y0 + liftRef.current + spread();
    if (group.current.position.y !== y) group.current.position.y = y;
  });

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
    fill(pillarsRef.current, facade.pillars);
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

  // Clic en cualquier bloque (también en el que ha subido) abre esa planta.
  const handlers = {
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
  };

  return (
    <group ref={group} {...handlers}>
      <mesh geometry={plateGeo} material={mats.plate} castShadow receiveShadow />
      <group ref={shell}>
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
        {terrace && (
          <group position={[0, h, 0]}>
            <mesh geometry={terrace.slab} material={mats.roof} castShadow receiveShadow />
            <mesh
              geometry={terrace.deck}
              material={mats.terrace}
              receiveShadow
              raycast={NO_RAYCAST}
            />
            <mesh geometry={terrace.rail} material={mats.rail} castShadow raycast={NO_RAYCAST} />
          </group>
        )}
      </group>
      <instancedMesh
        ref={pillarsRef}
        args={[resources.unit, mats.pillar, facade.pillars.length]}
        castShadow
        receiveShadow
      />
      {furniture.length > 0 && (
        <instancedMesh
          ref={furnitureRef}
          args={[resources.unit, mats.furniture, furniture.length]}
          castShadow
          receiveShadow
          raycast={NO_RAYCAST}
        />
      )}
      {interior.geometry && (
        <mesh geometry={interior.geometry} material={mats.rooms} receiveShadow />
      )}
      {interior.hatch && (
        <mesh geometry={interior.hatch} material={mats.hatch} visible={active} receiveShadow />
      )}
      <mesh geometry={resources.core(coreHeight)} material={mats.core} castShadow receiveShadow />
      <mesh geometry={resources.coreWin(h)} material={mats.dark} raycast={NO_RAYCAST} />
      {floor.off && (
        <mesh
          geometry={resources.canopy}
          material={resources.mats.canopy}
          castShadow
          raycast={NO_RAYCAST}
        />
      )}
      {isTop && <Roof entry={entry} hidden={selected} resources={resources} reduced={reduced} />}
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
  autoRotate,
  spinKickRef,
  openRef,
  anchorFloorIds,
  onFloorAnchors,
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

  // Encuadre cerrado (68-70 % del alto) y encuadre del edificio partido, que debe caber entero con margen.
  const closedView = useMemo(
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
  const openView = useMemo(
    () =>
      selectedLevel === null
        ? null
        : fitCamera({
            width,
            height,
            fovDeg: CAMERA.fov,
            azimuth: AZIMUTH,
            elevation: ELEVATION,
            target: new Vector3(1.2, (total + LIFT) * 0.47, 0.8),
            layout,
            selectedLevel,
            fill: 0.92,
          }),
    [width, height, total, layout, selectedLevel],
  );
  const view = openView ?? closedView;
  const farthest = Math.max(closedView.distance, view.distance);

  // Exposición baja para que el lima y el crema no se quemen con ACES.
  useLayoutEffect(() => {
    getState().gl.toneMappingExposure = EXPOSURE;
    invalidate();
  }, [getState, invalidate]);

  // Encuadre: la primera vez, el 3/4 inicial; al abrir o cerrar una planta, la cámara viaja en DURATION ms
  // conservando el ángulo al que el usuario giró; al cambiar el tamaño se recoloca sin animar.
  const cameraTween = useRef(null);
  const prevLevel = useRef(selectedLevel);
  useLayoutEffect(() => {
    const ctl = controls.current;
    const levelChanged = prevLevel.current !== selectedLevel;
    prevLevel.current = selectedLevel;
    if (framed.current && levelChanged && !reduced && ctl) {
      cameraTween.current = {
        fromTarget: ctl.target.clone(),
        last: ctl.target.clone(),
        fromDistance: camera.position.distanceTo(ctl.target),
        toTarget: view.target.clone(),
        toDistance: view.distance,
        t0: performance.now(),
      };
      invalidate();
      return;
    }
    const dir = new Vector3();
    if (framed.current && ctl) {
      dir.subVectors(camera.position, ctl.target).normalize();
    } else {
      dir.set(
        Math.cos(ELEVATION) * Math.sin(AZIMUTH),
        Math.sin(ELEVATION),
        Math.cos(ELEVATION) * Math.cos(AZIMUTH),
      );
      framed.current = true;
    }
    cameraTween.current = null;
    ctl?.target.copy(view.target);
    camera.position.copy(view.target).addScaledVector(dir, view.distance);
    camera.lookAt(view.target);
    camera.updateProjectionMatrix();
    ctl?.update();
    invalidate();
  }, [camera, view, selectedLevel, reduced, invalidate]);

  useFrame(() => {
    const tween = cameraTween.current;
    const ctl = controls.current;
    if (!tween || !ctl) return;
    const p = Math.min(1, (performance.now() - tween.t0) / DURATION);
    const e = ease(p);
    const dir = camera.position.clone().sub(tween.last).normalize();
    ctl.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    tween.last.copy(ctl.target);
    const distance = tween.fromDistance + (tween.toDistance - tween.fromDistance) * e;
    camera.position.copy(ctl.target).addScaledVector(dir, distance);
    ctl.update();
    if (p < 1) invalidate();
    else cameraTween.current = null;
  });

  // Giro automático (solo si `autoRotate`): lento y continuo, con el empuje extra del scroll (`spinKickRef`).
  // Se pausa fuera de pantalla, con la pestaña oculta, mientras se arrastra y 3 s después de soltar. Como el render
  // es bajo demanda, mientras gira pide un fotograma tras otro; en pausa no gasta nada.
  const gl = useThree((state) => state.gl);
  const onScreen = useRef(true);
  const dragging = useRef(false);
  const lastDragEnd = useRef(-Infinity);
  const kickApplied = useRef(0);
  useEffect(() => {
    if (!autoRotate || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
    });
    observer.observe(gl.domElement);
    return () => observer.disconnect();
  }, [autoRotate, gl]);

  const anchorEntries = useMemo(
    () =>
      (anchorFloorIds ?? []).map((id) => layout.find((entry) => entry.floor.id === id)).filter(Boolean),
    [anchorFloorIds, layout],
  );

  useFrame(() => {
    const ctl = controls.current;
    if (!ctl) return;
    if (autoRotate) {
      const idle = performance.now() - lastDragEnd.current > RESUME_MS;
      const spinning =
        onScreen.current &&
        !document.hidden &&
        !dragging.current &&
        idle &&
        !cameraTween.current;
      ctl.autoRotate = spinning;
      if (spinning) invalidate();
      const kick = spinKickRef?.current ?? 0;
      const delta = kick - kickApplied.current;
      if (onScreen.current && Math.abs(delta) > 1e-4) {
        const offset = camera.position.clone().sub(ctl.target).applyAxisAngle(UP, -delta);
        camera.position.copy(ctl.target).add(offset);
        camera.lookAt(ctl.target);
        kickApplied.current = kick;
        ctl.update();
        invalidate();
      }
    }
    // Posición en pantalla (px del lienzo) de cada planta pedida, para colocar las estampas a su altura.
    if (onFloorAnchors && anchorEntries.length > 0) {
      const anchors = {};
      for (const entry of anchorEntries) {
        const spread = openRef ? openRef.current * entry.floor.number * SPREAD : 0;
        ANCHOR_POINT.set(1.2, entry.y0 + entry.h * 0.5 + spread, 0.8).project(camera);
        anchors[entry.floor.id] = {
          x: (ANCHOR_POINT.x * 0.5 + 0.5) * width,
          y: (-ANCHOR_POINT.y * 0.5 + 0.5) * height,
        };
      }
      onFloorAnchors(anchors);
    }
  });

  // Giro con el teclado (flechas del contenedor): un paso fijo alrededor del edificio. Solo si `turnRef` existe.
  useEffect(() => {
    if (!turnRef) return undefined;
    turnRef.current = (step) => {
      const ctl = controls.current;
      if (!ctl) return;
      const offset = camera.position.clone().sub(ctl.target).applyAxisAngle(UP, step);
      camera.position.copy(ctl.target).add(offset);
      camera.lookAt(ctl.target);
      ctl.update();
      invalidate();
    };
    return () => {
      turnRef.current = null;
    };
  }, [turnRef, camera, invalidate]);

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
        shadow-radius={2}
      />
      {/* Relleno frío, sin sombra, desde el lado contrario al sol: el tono más fresco de la paleta. */}
      <directionalLight color={colors['crema-suave']} intensity={0.35} position={[30, 10, 6]} />
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={zoom}
        enableDamping={!reduced}
        dampingFactor={0.08}
        rotateSpeed={0.7}
        autoRotateSpeed={AUTO_SPEED}
        onStart={() => {
          dragging.current = true;
        }}
        onEnd={() => {
          dragging.current = false;
          lastDragEnd.current = performance.now();
        }}
        minPolarAngle={0.55}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={Math.min(closedView.distance, view.distance) * 0.55}
        maxDistance={farthest * 1.25}
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
          openRef={autoRotate ? openRef : undefined}
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
  // Giro automático y estampas (opcionales; por defecto, el comportamiento de siempre). `spinKickRef` y `openRef`
  // son refs con un número que el scroll actualiza; `onFloorAnchors` recibe { idPlanta: { x, y } } en px del lienzo.
  autoRotate = false,
  spinKickRef,
  openRef,
  anchorFloorIds,
  onFloorAnchors,
  // Con `false` no hay giro con las flechas ni rueda de zoom con el foco (la landing usa las estampas como teclado).
  keyboardTurn = true,
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
  const keyboardProps = keyboardTurn
    ? {
        tabIndex: 0,
        role: 'group',
        'aria-label': 'Edificio en 3D. Gira con las flechas izquierda y derecha',
        onKeyDown,
        onFocus: () => setZoom(true),
        onBlur: () => setZoom(false),
      }
    : {};
  return (
    <div className={styles.grupo} {...keyboardProps}>
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
          turnRef={keyboardTurn ? turnRef : null}
          zoom={zoom}
          autoRotate={autoRotate && !reduced}
          spinKickRef={spinKickRef}
          openRef={openRef}
          anchorFloorIds={anchorFloorIds}
          onFloorAnchors={onFloorAnchors}
        />
      </LazyCanvas>
    </div>
  );
}
