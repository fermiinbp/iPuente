// Medidas (en metros) y constructores de geometría del edificio 3D. Sin React: solo funciones puras que
// devuelven geometrías y matrices, para que Building3D.jsx las comparta entre plantas (instancias y mallas fusionadas).
import { BoxGeometry, BufferAttribute, Object3D, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BASE_Y = 0.18; // altura de la acera
export const GROUND_H = 4.6; // planta baja: vestíbulo alto
export const FLOOR_H = 3.4; // plantas tipo
export const SLAB_T = 0.34; // forjado (el canto se ve en cada planta)
export const OVERHANG = 0.3; // cuánto sobresale el forjado del vidrio
export const ROOF_T = 0.3;
export const PARAPET_H = 0.9;
export const LIFT = 7; // cuánto suben las plantas de encima de la seleccionada
export const BAY = 1.5; // separación de montantes
export const FULL_PLAN = { cx: 0, cz: 0, w: 24, d: 12 }; // planta 2:1
export const SETBACK_PLAN = { cx: 2, cz: -1.8, w: 20, d: 8.4 }; // retranqueo de las dos últimas plantas
export const CORE = { w: 3.2, d: 5, x: 13.5, z: -1.2, cap: 2.8 }; // escalera y ascensor, pegados al lado derecho
export const PLAZA = { w: 46, d: 32 };

const WALL_T = 0.14;
const WALL_H = 1.25;
const DOOR_W = 1.1;
const FLOOR_TILE = 0.08;

// Seis salas por planta, como en el mockup (unidades de la losa original de 4,3 x 2,9).
const LAYOUT = [
  [-1.445, -0.8, 1.21, 1.1],
  [0.035, -0.8, 1.63, 1.1],
  [1.48, -0.8, 1.14, 1.1],
  [-1.135, 0.72, 1.83, 1.1],
  [0.46, 0.72, 1.24, 1.1],
  [1.595, 0.72, 0.91, 1.1],
];
const REF = { w: 4.3, d: 2.9 };

// Plantas de abajo arriba con su altura, su planta (huella) y si son la última.
export function layoutFloors(floors) {
  const sorted = [...floors].sort((a, b) => a.number - b.number);
  const top = sorted.length ? sorted[sorted.length - 1].number : 0;
  let y = BASE_Y;
  return sorted.map((floor) => {
    const h = floor.off ? GROUND_H : FLOOR_H;
    const setback = !floor.off && sorted.length > 3 && floor.number >= top - 1;
    const entry = {
      floor,
      y0: y,
      h,
      plan: setback ? SETBACK_PLAN : FULL_PLAN,
      isTop: floor.number === top,
    };
    y += h;
    return entry;
  });
}

export function buildingHeight(layout) {
  const last = layout[layout.length - 1];
  return last ? last.y0 + last.h : 0;
}

// Forjado de una planta: placa con bordes biselados que sobresale del vidrio. Origen en la base de la planta.
export function plateGeometry(plan) {
  const g = new RoundedBoxGeometry(plan.w + OVERHANG * 2, SLAB_T, plan.d + OVERHANG * 2, 2, 0.06);
  g.translate(plan.cx, SLAB_T / 2, plan.cz);
  return g;
}

// Núcleo de comunicaciones: pieza maciza; la de la última planta sobresale por encima de la cubierta.
export function coreGeometry(height) {
  const g = new RoundedBoxGeometry(CORE.w, height, CORE.d, 2, 0.1);
  g.translate(CORE.x, height / 2, CORE.z);
  return g;
}

// Vidrios (instancias) y montantes de la fachada: cada ~1,5 m, ajustados al largo de cada cara.
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
      dummy.scale.set(bay - 0.12, paneH, 0.05);
      dummy.updateMatrix();
      panes.push(dummy.matrix.clone());
    }
    for (let i = 0; i <= n; i++) {
      if (!face.ends && (i === 0 || i === n)) continue; // las esquinas ya las pone la otra cara
      dummy.position.set(...at(-face.len / 2 + i * bay));
      dummy.rotation.set(0, face.rot, 0);
      dummy.scale.set(0.14, paneH, 0.26);
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

// Interior de una planta: suelo, tabiques bajos con hueco de puerta y, en la planta baja, el vestíbulo.
// Guarda dos juegos de colores (neutro y de estado) para cambiar de uno a otro sin rehacer la malla.
export function buildInterior(plan, floor, palette) {
  const parts = [];
  const neutral = [];
  const state = [];
  const add = (g, colorNeutral, colorState) => {
    const count = g.getAttribute('position').count;
    pushColor(neutral, count, colorNeutral);
    pushColor(state, count, colorState);
    parts.push(g);
  };
  const baseY = SLAB_T;
  const hatchParts = [];

  if (floor.off) {
    // Vestíbulo: suelo, mostrador de recepción, pilares y bancos.
    const h = floor.off ? GROUND_H - SLAB_T : FLOOR_H - SLAB_T;
    add(
      boxAt(plan.w - 0.6, FLOOR_TILE, plan.d - 0.6, plan.cx, baseY + FLOOR_TILE / 2, plan.cz),
      palette.floorNeutral,
      palette.floorNeutral,
    );
    add(
      boxAt(5, 1.1, 1.1, plan.cx - 4, baseY + FLOOR_TILE + 0.55, plan.cz + 1),
      palette.bronce,
      palette.bronce,
    );
    for (const px of [-8, -2.7, 2.7, 8]) {
      add(
        boxAt(0.5, h, 0.5, plan.cx + px, baseY + h / 2, plan.cz - 2.4),
        palette.wallNeutral,
        palette.wallNeutral,
      );
    }
    for (const px of [3.5, 7]) {
      add(
        boxAt(2.2, 0.45, 0.8, plan.cx + px, baseY + FLOOR_TILE + 0.22, plan.cz + 2.4),
        palette.wallNeutral,
        palette.wallNeutral,
      );
    }
  } else {
    const sx = (plan.w / REF.w) * 0.97;
    const sz = (plan.d / REF.d) * 0.97;
    const stateColor = { free: palette.free, busy: palette.busy, off: palette.off };
    LAYOUT.forEach(([x, z, w, d], i) => {
      const status = floor.rooms?.[i];
      if (!status) return;
      const cs = stateColor[status] ?? palette.off;
      const rw = w * sx;
      const rd = d * sz;
      const cx = plan.cx + x * sx;
      const cz = plan.cz + z * sz;
      add(boxAt(rw, FLOOR_TILE, rd, cx, baseY + FLOOR_TILE / 2, cz), palette.floorNeutral, cs);
      const wy = baseY + FLOOR_TILE + WALL_H / 2;
      add(boxAt(WALL_T, WALL_H, rd, cx - rw / 2 + WALL_T / 2, wy, cz), palette.wallNeutral, cs);
      add(boxAt(WALL_T, WALL_H, rd, cx + rw / 2 - WALL_T / 2, wy, cz), palette.wallNeutral, cs);
      // La puerta da al pasillo central: las salas de atrás abren hacia delante y al revés.
      const toFront = z < 0 ? 1 : -1;
      add(
        boxAt(rw, WALL_H, WALL_T, cx, wy, cz - toFront * (rd / 2 - WALL_T / 2)),
        palette.wallNeutral,
        cs,
      );
      const seg = (rw - DOOR_W) / 2;
      for (const side of [-1, 1]) {
        add(
          boxAt(
            seg,
            WALL_H,
            WALL_T,
            cx + side * (DOOR_W / 2 + seg / 2),
            wy,
            cz + toFront * (rd / 2 - WALL_T / 2),
          ),
          palette.wallNeutral,
          cs,
        );
      }
      if (status === 'off') {
        hatchParts.push(boxAt(rw * 0.96, 0.02, rd * 0.96, cx, baseY + FLOOR_TILE + 0.011, cz));
      }
    });
  }

  const geometry = mergeAll(parts);
  if (geometry) {
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(neutral), 3));
  }

  // Trama de «no se alquila» en el suelo: la UV va en metros para que las rayas no se deformen.
  let hatch = null;
  if (hatchParts.length) {
    for (const g of hatchParts) {
      const pos = g.getAttribute('position');
      const uv = g.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.35, pos.getZ(i) * 0.35);
    }
    hatch = mergeAll(hatchParts);
  }

  return {
    geometry,
    hatch,
    neutral: new Float32Array(neutral),
    state: new Float32Array(state),
  };
}

// Cubierta: placa, peto perimetral, máquinas de climatización (instancias) y lucernario.
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

export function hvacMatrices(plan) {
  const dummy = new Object3D();
  const units = [
    [-6, -1.2, 3.2, 1.5, 2.1],
    [-1.5, -1.6, 2.6, 1.1, 1.8],
    [3, -1, 3, 1.7, 2.2],
  ];
  return units.map(([x, z, w, h, d]) => {
    dummy.position.set(plan.cx + x, ROOF_T + h / 2, plan.cz + z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
}

export function skylightMatrix(plan) {
  const dummy = new Object3D();
  dummy.position.set(plan.cx + 6.5, ROOF_T + 0.45, plan.cz + 1.8);
  dummy.scale.set(3.4, 0.9, 2.2);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

// Marquesina de la entrada (pieza de bronce) con dos pilares y el hueco de la puerta.
export function canopyGeometry(palette) {
  const z = FULL_PLAN.d / 2 + 1.5;
  const parts = [];
  const colors = [];
  const add = (g, color) => {
    pushColor(colors, g.getAttribute('position').count, color);
    parts.push(g);
  };
  const slab = new RoundedBoxGeometry(6.4, 0.22, 3.4, 2, 0.05);
  slab.translate(0, 3.5, z);
  add(slab, palette.bronce);
  add(boxAt(0.2, 3.4, 0.2, -2.9, 1.7, z + 1.4), palette.bronce);
  add(boxAt(0.2, 3.4, 0.2, 2.9, 1.7, z + 1.4), palette.bronce);
  add(boxAt(2.4, 2.8, 0.12, 0, 1.4 + SLAB_T / 2, FULL_PLAN.d / 2 + 0.02), palette.door);
  const geometry = mergeAll(parts);
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}

// Plaza y acera: dos tonos en una sola malla.
export function plazaGeometry(palette) {
  const parts = [];
  const colors = [];
  const add = (g, color) => {
    pushColor(colors, g.getAttribute('position').count, color);
    parts.push(g);
  };
  add(boxAt(PLAZA.w, 0.1, PLAZA.d, 0, -0.05 + BASE_Y - 0.08, 0), palette.plaza);
  add(boxAt(FULL_PLAN.w + 5.2, 0.08, FULL_PLAN.d + 7, 0.4, BASE_Y - 0.04, 1.6), palette.sidewalk);
  const geometry = mergeAll(parts);
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}

// Árboles low-poly de la plaza: posición y escala.
export const TREES = [
  [-16.5, 9, 1.05],
  [-9.5, 11, 0.85],
  [10, 11.5, 1],
  [17.5, 8.5, 1.15],
  [-17, -8, 1.1],
  [8, -11, 0.9],
];

// Distancia de cámara para que el edificio ocupe ~70 % del alto y quepa a lo ancho (proyección ortogonal aproximada).
export function fitDistance({ aspect, fovDeg, azimuth, elevation, target, height }) {
  const v = new Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  );
  const right = new Vector3(v.z, 0, -v.x).normalize();
  const up = new Vector3().crossVectors(v, right).normalize();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const p = new Vector3();
  for (const x of [-12.5, 15.2]) {
    for (const z of [-6.5, 9.3]) {
      for (const y of [0, height + CORE.cap + ROOF_T]) {
        p.set(x, y, z).sub(target);
        const px = p.dot(right);
        const py = p.dot(up);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }
  const k = 2 * Math.tan((fovDeg * Math.PI) / 360);
  const byHeight = (maxY - minY) / (0.74 * k);
  const byWidth = (maxX - minX) / (0.92 * k * Math.max(aspect, 0.3));
  return Math.max(byHeight, byWidth);
}
