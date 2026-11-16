// Medidas (en metros) y constructores de geometría del edificio 3D. Sin React: solo funciones puras que
// devuelven geometrías y matrices, para que Building3D.jsx las comparta entre plantas (instancias y mallas fusionadas).
// Base del mockup: 5 plantas iguales, huella 1,25:1, forjados finos y seis bloques de sala por planta; encima,
// una fachada de vidrio sutil (montantes finos) y una cubierta con peto, máquinas y una caseta.
import { BoxGeometry, BufferAttribute, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FLOOR_H = 4.2; // altura de cada planta (forjado incluido)
export const SLAB_T = 0.5; // forjado fino
export const OVERHANG = 0.45; // cuánto sobresale el forjado del vidrio
export const ROOF_T = 0.3;
export const PARAPET_H = 0.8;
export const LIFT = 7; // cuánto suben las plantas de encima de la seleccionada
export const BAY = 2; // separación de montantes
export const FULL_PLAN = { cx: 0, cz: 0, w: 20, d: 16 }; // huella 1,25:1 (lado largo en x)
const HUT = { x: 5.5, z: -3.2, w: 3.2, h: 2.2, d: 2.6 }; // caseta de la escalera, sobre la cubierta

const LABEL_H = 4; // alto que ocupan las etiquetas sobre la planta abierta
const BLOCK_GAP = 0.55; // aire entre la tapa del bloque y el forjado de encima
const TILE_T = 0.14; // sala «plana» de la planta abierta
const BLOCK_BEVEL = 0.1;

// Seis salas por planta: tres a lo largo del lado largo y dos filas con un pasillo en medio
// (unidades de la losa original de 4,3 x 2,9; se escalan a la huella).
const LAYOUT = [
  [-1.445, -0.8, 1.21, 1.1],
  [0.035, -0.8, 1.63, 1.1],
  [1.48, -0.8, 1.14, 1.1],
  [-1.135, 0.72, 1.83, 1.1],
  [0.46, 0.72, 1.24, 1.1],
  [1.595, 0.72, 0.91, 1.1],
];
const REF = { w: 4.3, d: 2.9 };

export const STATUS_LABEL = { free: 'Libre', busy: 'Ocupada', off: 'No se alquila' };

// Código de sala como en el mockup: «2.01» (planta 2, sala 1).
export function roomCode(floor, index) {
  return `${floor.number}.0${index + 1}`;
}

// Plantas de abajo arriba, todas con la misma altura y huella.
export function layoutFloors(floors) {
  const sorted = [...floors].sort((a, b) => a.number - b.number);
  const top = sorted.length ? sorted[sorted.length - 1].number : 0;
  let y = 0;
  return sorted.map((floor) => {
    const entry = { floor, y0: y, h: FLOOR_H, plan: FULL_PLAN, isTop: floor.number === top };
    y += FLOOR_H;
    return entry;
  });
}

export function buildingHeight(layout) {
  const last = layout[layout.length - 1];
  return last ? last.y0 + last.h : 0;
}

// Rectángulos (x, z, ancho, fondo) de las seis salas de una planta, en coordenadas de la planta.
export function roomRects(plan) {
  const sx = (plan.w / REF.w) * 0.97;
  const sz = (plan.d / REF.d) * 0.97;
  return LAYOUT.map(([x, z, w, d]) => ({
    x: plan.cx + x * sx,
    z: plan.cz + z * sz,
    w: w * sx,
    d: d * sz,
  }));
}

// Forjado de una planta: placa fina con bordes biselados que sobresale del vidrio. Origen en la base de la planta.
export function plateGeometry(plan) {
  const g = new RoundedBoxGeometry(plan.w + OVERHANG * 2, SLAB_T, plan.d + OVERHANG * 2, 2, 0.08);
  g.translate(plan.cx, SLAB_T / 2, plan.cz);
  return g;
}

// Vidrios (instancias) y montantes de la fachada: cada ~1,6 m, ajustados al largo de cada cara.
export function facadeMatrices(plan, h) {
  const paneH = h - SLAB_T;
  const y = SLAB_T + paneH / 2;
  const dummy = new Object3D();
  const panes = [];
  const mullions = [];
  const faces = [
    { len: plan.w, x: 0, z: plan.d / 2, rot: 0, ends: true },
    { len: plan.w, x: 0, z: -plan.d / 2, rot: 0, ends: true },
    { len: plan.d, x: plan.w / 2, z: 0, rot: Math.PI / 2, ends: false },
    { len: plan.d, x: -plan.w / 2, z: 0, rot: Math.PI / 2, ends: false },
  ];
  for (const face of faces) {
    const n = Math.max(1, Math.round(face.len / BAY));
    const bay = face.len / n;
    const at = (s) =>
      face.rot === 0 ? [plan.cx + s, y, plan.cz + face.z] : [plan.cx + face.x, y, plan.cz + s];
    for (let i = 0; i < n; i++) {
      dummy.position.set(...at(-face.len / 2 + (i + 0.5) * bay));
      dummy.rotation.set(0, face.rot, 0);
      dummy.scale.set(bay - 0.08, paneH, 0.04);
      dummy.updateMatrix();
      panes.push(dummy.matrix.clone());
    }
    for (let i = 0; i <= n; i++) {
      if (!face.ends && (i === 0 || i === n)) continue; // las esquinas ya las pone la otra cara
      dummy.position.set(...at(-face.len / 2 + i * bay));
      dummy.rotation.set(0, face.rot, 0);
      dummy.scale.set(0.09, paneH, 0.16);
      dummy.updateMatrix();
      mullions.push(dummy.matrix.clone());
    }
  }
  return { panes, mullions };
}

function boxAt(w, h, d, x, y, z) {
  // No indexada, como RoundedBoxGeometry: mergeGeometries exige que todas sean iguales.
  const indexed = new BoxGeometry(w, h, d);
  const g = indexed.toNonIndexed();
  indexed.dispose();
  g.translate(x, y, z);
  return g;
}

function pushColor(out, count, color) {
  for (let i = 0; i < count; i++) out.push(color.r, color.g, color.b);
}

function mergeAll(parts) {
  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return merged;
}

// Bloques de sala de una planta cerrada (una sola malla). Guarda dos juegos de colores (neutro, como el mockup,
// y de estado) para pasar de uno a otro sin rehacer la malla; el vidrio de encima deja verlos.
export function buildBlocks(plan, floor, palette) {
  const parts = [];
  const neutral = [];
  const state = [];
  const stateColor = { free: palette.free, busy: palette.busy, off: palette.off };
  const height = FLOOR_H - SLAB_T - BLOCK_GAP;
  roomRects(plan).forEach((room, i) => {
    const status = floor.rooms?.[i];
    if (!status) return;
    const g = new RoundedBoxGeometry(room.w, height, room.d, 2, BLOCK_BEVEL);
    g.translate(room.x, SLAB_T + height / 2, room.z);
    const count = g.getAttribute('position').count;
    pushColor(neutral, count, palette.block);
    pushColor(state, count, stateColor[status] ?? palette.off);
    parts.push(g);
  });
  const geometry = mergeAll(parts);
  if (geometry) geometry.setAttribute('color', new BufferAttribute(new Float32Array(neutral), 3));
  return { geometry, neutral: new Float32Array(neutral), state: new Float32Array(state) };
}

// Planta abierta: salas planas (una por sala, para poder pulsarlas) y la trama de «No se alquila» en una sola malla.
export function buildOpenRooms(plan, floor) {
  const rooms = [];
  const hatchParts = [];
  roomRects(plan).forEach((room, i) => {
    const status = floor.rooms?.[i];
    if (!status) return;
    rooms.push({ index: i, status, ...room, y: SLAB_T + TILE_T / 2, top: SLAB_T + TILE_T });
    if (status === 'off') {
      hatchParts.push(
        boxAt(room.w * 0.96, 0.02, room.d * 0.96, room.x, SLAB_T + TILE_T + 0.011, room.z),
      );
    }
  });
  // La UV va en metros para que las rayas no se deformen.
  for (const g of hatchParts) {
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.35, pos.getZ(i) * 0.35);
  }
  return { rooms, hatch: mergeAll(hatchParts), tileT: TILE_T };
}

// Contorno de una sala (marco fino) para resaltar la elegida.
export function roomOutlineGeometry(room) {
  const t = 0.18;
  const w = room.w + 0.2;
  const d = room.d + 0.2;
  const y = SLAB_T + TILE_T + 0.03;
  return mergeAll([
    boxAt(w, 0.06, t, room.x, y, room.z + d / 2 - t / 2),
    boxAt(w, 0.06, t, room.x, y, room.z - d / 2 + t / 2),
    boxAt(t, 0.06, d - t * 2, room.x + w / 2 - t / 2, y, room.z),
    boxAt(t, 0.06, d - t * 2, room.x - w / 2 + t / 2, y, room.z),
  ]);
}

// Cubierta: placa y peto perimetral.
export function roofGeometry(plan) {
  const w = plan.w + OVERHANG * 2;
  const d = plan.d + OVERHANG * 2;
  const plate = new RoundedBoxGeometry(w, ROOF_T, d, 2, 0.06);
  plate.translate(plan.cx, ROOF_T / 2, plan.cz);
  const py = ROOF_T + PARAPET_H / 2;
  const t = 0.22;
  return mergeAll([
    plate,
    boxAt(w, PARAPET_H, t, plan.cx, py, plan.cz + d / 2 - t / 2),
    boxAt(w, PARAPET_H, t, plan.cx, py, plan.cz - d / 2 + t / 2),
    boxAt(t, PARAPET_H, d - t * 2, plan.cx + w / 2 - t / 2, py, plan.cz),
    boxAt(t, PARAPET_H, d - t * 2, plan.cx - w / 2 + t / 2, py, plan.cz),
  ]);
}

// Dos máquinas de climatización y la caseta de la escalera: tres cajas instanciadas.
export function roofBoxMatrices(plan) {
  const dummy = new Object3D();
  const units = [
    [-5.5, 3.5, 3.2, 1.3, 2],
    [-1.5, 4.2, 2.6, 1.1, 1.8],
  ];
  const hvac = units.map(([x, z, w, h, d]) => {
    dummy.position.set(plan.cx + x, ROOF_T + h / 2, plan.cz + z);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
  dummy.position.set(plan.cx + HUT.x, ROOF_T + HUT.h / 2, plan.cz + HUT.z);
  dummy.scale.set(HUT.w, HUT.h, HUT.d);
  dummy.updateMatrix();
  return { hvac, hut: dummy.matrix.clone() };
}

// Encuadre: distancia y punto de mira para que el edificio ocupe `fracH` del alto del canvas y no pase de
// `fracW` del ancho (así no se sale de la columna del hero). Proyecta las esquinas con la cámara real.
// Con `floorY` encuadra solo una planta abierta (su forjado, las salas planas y las etiquetas), sin cubierta.
export function fitView({ aspect, fovDeg, azimuth, elevation, plan, height, fracH, fracW, floorY }) {
  const w = plan.w / 2 + OVERHANG;
  const d = plan.d / 2 + OVERHANG;
  const top = height + ROOF_T + PARAPET_H;
  const hutTop = height + ROOF_T + HUT.h;
  const open = floorY !== undefined;
  const yMin = open ? floorY : 0;
  const yMax = open ? floorY + SLAB_T + LABEL_H : top;
  const points = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      points.push(new Vector3(plan.cx + sx * w, yMin, plan.cz + sz * d));
      points.push(new Vector3(plan.cx + sx * w, yMax, plan.cz + sz * d));
      if (!open) {
        points.push(
          new Vector3(
            plan.cx + HUT.x + (sx * HUT.w) / 2,
            hutTop,
            plan.cz + HUT.z + (sz * HUT.d) / 2,
          ),
        );
      }
    }
  }
  const dir = new Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  );
  const target = new Vector3(plan.cx, (yMin + (open ? yMax : Math.max(top, hutTop))) / 2, plan.cz);
  const cam = new PerspectiveCamera(fovDeg, aspect, 1, 1000);
  const half = Math.tan((fovDeg * Math.PI) / 360);
  const ndc = new Vector3();
  let distance = 80;
  for (let i = 0; i < 12; i++) {
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      ndc.copy(p).project(cam);
      minX = Math.min(minX, ndc.x);
      maxX = Math.max(maxX, ndc.x);
      minY = Math.min(minY, ndc.y);
      maxY = Math.max(maxY, ndc.y);
    }
    const scale = Math.max((maxY - minY) / 2 / fracH, (maxX - minX) / 2 / fracW);
    distance *= scale;
    // Centrado: se desplaza el punto de mira por el desvío del centro de la silueta en pantalla.
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, ((minX + maxX) / 2) * distance * half * aspect);
    target.addScaledVector(up, ((minY + maxY) / 2) * distance * half);
  }
  return { target, distance };
}
