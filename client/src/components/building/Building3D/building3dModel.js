// Medidas (en metros) y constructores de geometría del edificio 3D. Sin React: solo funciones puras que
// devuelven geometrías y matrices, para que Building3D.jsx las comparta entre plantas (instancias y mallas fusionadas).
import { BufferAttribute, Object3D, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BASE_Y = 0.18; // altura de la acera
export const GROUND_H = 4.6; // planta baja: vestíbulo alto
export const FLOOR_H = 3.4; // plantas tipo
export const SLAB_T = 0.34; // forjado (el canto se ve en cada planta)
export const OVERHANG = 0.3; // cuánto sobresale el forjado del vidrio
export const ROOF_T = 0.3;
export const PARAPET_H = 0.5;
export const RAIL_H = 0.55; // barandilla fina sobre el peto
export const SPANDREL_H = 0.95; // banda de antepecho opaca sobre cada forjado
export const LIFT = 7; // cuánto suben las plantas de encima de la seleccionada
export const BAY = 1.5; // separación de montantes
export const FULL_PLAN = { cx: 0, cz: 0, w: 24, d: 12 }; // planta 2:1
export const SETBACK_PLAN = { cx: 2, cz: -1.8, w: 20, d: 8.4 }; // retranqueo de las dos últimas plantas
export const CORE = { w: 3.2, d: 5, x: 13.5, z: -1.2, cap: 2.8 }; // escalera y ascensor, pegados al lado derecho
export const PLAZA = { w: 46, d: 32 };

const BEVEL = 0.02;
const WALL_T = 0.14;
const WALL_H = 1.25;
const DOOR_W = 1.1;
const FLOOR_TILE = 0.08;
const FLOOR_DIM = 0.4; // cuánto del color de estado se ve en el suelo en reposo

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
  const entries = sorted.map((floor) => {
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
  // Huella de la planta de encima: si es menor, el techo de esta queda al aire y hay que cerrarlo (terraza).
  entries.forEach((entry, i) => {
    entry.upperPlan = entries[i + 1]?.plan ?? null;
  });
  return entries;
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

// Fachada de una planta (instancias): vidrio, montantes y travesaño (perfiles con ~5 cm de relieve),
// banda de antepecho opaca sobre el forjado y pilares de esquina. La planta baja va sin antepecho (más transparente).
export function facadeMatrices(plan, h, ground = false) {
  const spandrel = ground ? 0 : SPANDREL_H;
  const glassY0 = SLAB_T + spandrel;
  const glassH = h - glassY0;
  const yGlass = glassY0 + glassH / 2;
  const dummy = new Object3D();
  const panes = [];
  const mullions = []; // montantes y travesaños: mismo material
  const bands = []; // antepechos y pilares: mismo material
  const put = (list, x, y, z, rot, sx, sy, sz) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    list.push(dummy.matrix.clone());
  };
  const faces = [
    { len: plan.w, x: 0, z: plan.d / 2, rot: 0, ends: true },
    { len: plan.w, x: 0, z: -plan.d / 2, rot: 0, ends: true },
    { len: plan.d, x: plan.w / 2, z: 0, rot: Math.PI / 2, ends: false },
    { len: plan.d, x: -plan.w / 2, z: 0, rot: Math.PI / 2, ends: false },
  ];
  for (const face of faces) {
    const n = Math.max(1, Math.round(face.len / BAY));
    const bay = face.len / n;
    const at = (s, y) =>
      face.rot === 0 ? [plan.cx + s, y, plan.cz + face.z] : [plan.cx + face.x, y, plan.cz + s];
    for (let i = 0; i < n; i++) {
      put(
        panes,
        ...at(-face.len / 2 + (i + 0.5) * bay, yGlass),
        face.rot,
        bay - 0.12,
        glassH,
        0.05,
      );
    }
    for (let i = 0; i <= n; i++) {
      if (!face.ends && (i === 0 || i === n)) continue; // las esquinas ya las pone la otra cara
      put(mullions, ...at(-face.len / 2 + i * bay, yGlass), face.rot, 0.12, glassH, 0.2);
    }
    // Travesaño a media altura del vidrio, con relieve.
    put(mullions, ...at(0, yGlass), face.rot, face.len, 0.08, 0.2);
    if (spandrel > 0)
      put(bands, ...at(0, SLAB_T + spandrel / 2), face.rot, face.len, spandrel, 0.16);
  }
  // Pilares en las cuatro esquinas.
  const colH = h - SLAB_T;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      put(
        bands,
        plan.cx + (sx * plan.w) / 2,
        SLAB_T + colH / 2,
        plan.cz + (sz * plan.d) / 2,
        0,
        0.42,
        colH,
        0.42,
      );
    }
  }
  return { panes, mullions, bands };
}

// Franjas verticales de ventanas pequeñas del núcleo (una planta): una en la cara frontal y dos en la lateral.
export function coreWindowGeometry(h) {
  const wh = h - 1.8;
  const y = h / 2;
  return mergeAll([
    boxAt(0.5, wh, 0.06, CORE.x, y, CORE.z + CORE.d / 2 + 0.02),
    boxAt(0.06, wh, 0.5, CORE.x + CORE.w / 2 + 0.02, y, CORE.z - 1),
    boxAt(0.06, wh, 0.5, CORE.x + CORE.w / 2 + 0.02, y, CORE.z + 1),
  ]);
}

// Caja con bisel de ~2 cm (menos en piezas más finas). No indexada, como RoundedBoxGeometry: mergeGeometries
// exige que todas sean iguales.
function boxAt(w, h, d, x, y, z) {
  const radius = Math.min(BEVEL, Math.min(w, h, d) / 2.5);
  const g = new RoundedBoxGeometry(w, h, d, 1, radius);
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
      // En reposo el suelo ya apunta el estado de la sala, atenuado; al resaltar la planta se ve entero.
      const dimmed = palette.floorNeutral.clone().lerp(cs, FLOOR_DIM);
      add(boxAt(rw, FLOOR_TILE, rd, cx, baseY + FLOOR_TILE / 2, cz), dimmed, cs);
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

// Siluetas de mobiliario (instancias de un cubo unidad): una mesa de reunión con su pie y cuatro sillas por sala.
// Las salas «no se alquila» van vacías y la planta baja ya tiene su vestíbulo.
export function furnitureMatrices(plan, floor) {
  if (floor.off) return [];
  const dummy = new Object3D();
  const out = [];
  const put = (x, y, z, sx, sy, sz) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    out.push(dummy.matrix.clone());
  };
  const sx = (plan.w / REF.w) * 0.97;
  const sz = (plan.d / REF.d) * 0.97;
  const y0 = SLAB_T + FLOOR_TILE;
  LAYOUT.forEach(([x, z, w, d], i) => {
    const status = floor.rooms?.[i];
    if (!status || status === 'off') return;
    const rw = w * sx;
    const rd = d * sz;
    const cx = plan.cx + x * sx;
    const cz = plan.cz + z * sz;
    const tw = Math.min(rw * 0.55, 1.7);
    const td = Math.min(rd * 0.3, 0.8);
    put(cx, y0 + 0.74, cz, tw, 0.05, td); // tablero
    put(cx, y0 + 0.36, cz, tw * 0.5, 0.72, td * 0.4); // pie
    for (const side of [-1, 1]) {
      for (const k of [-0.25, 0.25]) {
        put(cx + k * tw * 1.6, y0 + 0.23, cz + side * (td / 2 + 0.3), 0.38, 0.46, 0.38); // silla
      }
    }
  });
  return out;
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

const HVAC_UNITS = [
  [-6, -1.2, 3.2, 1.5, 2.1],
  [-1.5, -1.6, 2.6, 1.1, 1.8],
  [3, -1, 3, 1.7, 2.2],
];

export function hvacMatrices(plan) {
  const dummy = new Object3D();
  return HVAC_UNITS.map(([x, z, w, h, d]) => {
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

// Barandilla fina sobre el peto: postes cada ~1,5 m y pasamanos.
export function railGeometry(plan) {
  const w = plan.w + OVERHANG * 2 - 0.22;
  const d = plan.d + OVERHANG * 2 - 0.22;
  const y0 = ROOF_T + PARAPET_H;
  const parts = [];
  const post = (x, z) =>
    parts.push(boxAt(0.05, RAIL_H, 0.05, plan.cx + x, y0 + RAIL_H / 2, plan.cz + z));
  const nx = Math.max(1, Math.round(w / BAY));
  const nz = Math.max(1, Math.round(d / BAY));
  for (let i = 0; i <= nx; i++) {
    post(-w / 2 + (i * w) / nx, d / 2);
    post(-w / 2 + (i * w) / nx, -d / 2);
  }
  for (let j = 1; j < nz; j++) {
    post(w / 2, -d / 2 + (j * d) / nz);
    post(-w / 2, -d / 2 + (j * d) / nz);
  }
  const yr = y0 + RAIL_H;
  parts.push(boxAt(w, 0.04, 0.04, plan.cx, yr, plan.cz + d / 2));
  parts.push(boxAt(w, 0.04, 0.04, plan.cx, yr, plan.cz - d / 2));
  parts.push(boxAt(0.04, 0.04, d, plan.cx + w / 2, yr, plan.cz));
  parts.push(boxAt(0.04, 0.04, d, plan.cx - w / 2, yr, plan.cz));
  return mergeAll(parts);
}

// Rejilla de cada máquina: panel oscuro en su cara frontal.
export function hvacGrilleMatrices(plan) {
  const dummy = new Object3D();
  return HVAC_UNITS.map(([x, z, w, h, d]) => {
    dummy.position.set(plan.cx + x, ROOF_T + h * 0.5, plan.cz + z + d / 2 + 0.02);
    dummy.scale.set(w * 0.72, h * 0.6, 0.05);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
}

// Mobiliario de la acera (escala humana): dos bancos y dos farolas, en una sola malla con color por vértice.
export function streetFurnitureGeometry(palette) {
  const parts = [];
  const colors = [];
  const add = (g, color) => {
    pushColor(colors, g.getAttribute('position').count, color);
    parts.push(g);
  };
  const y = BASE_Y;
  for (const x of [-7.5, 7.5]) {
    add(boxAt(1.7, 0.08, 0.45, x, y + 0.45, 9.8), palette.bronce);
    add(boxAt(1.7, 0.4, 0.06, x, y + 0.72, 10.02), palette.bronce);
    add(boxAt(0.08, 0.45, 0.4, x - 0.7, y + 0.22, 9.8), palette.door);
    add(boxAt(0.08, 0.45, 0.4, x + 0.7, y + 0.22, 9.8), palette.door);
  }
  for (const x of [-10.5, 10.5]) {
    add(boxAt(0.1, 4.2, 0.1, x, y + 2.1, 10.4), palette.door);
    add(boxAt(0.5, 0.12, 0.3, x, y + 4.26, 10.4), palette.wallNeutral);
  }
  const geometry = mergeAll(parts);
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}

function planRect(plan) {
  return {
    x0: plan.cx - plan.w / 2 - OVERHANG,
    x1: plan.cx + plan.w / 2 + OVERHANG,
    z0: plan.cz - plan.d / 2 - OVERHANG,
    z1: plan.cz + plan.d / 2 + OVERHANG,
  };
}

// Lados de la planta que quedan al aire (la de encima está retranqueada más de 0,5 m).
function openSides(L, U) {
  return [
    { open: U.x0 - L.x0 > 0.5, axis: 'z', at: L.x0, a: L.z0, b: L.z1, dir: 1 },
    { open: L.x1 - U.x1 > 0.5, axis: 'z', at: L.x1, a: L.z0, b: L.z1, dir: -1 },
    { open: U.z0 - L.z0 > 0.5, axis: 'x', at: L.z0, a: L.x0, b: L.x1, dir: 1 },
    { open: L.z1 - U.z1 > 0.5, axis: 'x', at: L.z1, a: L.x0, b: L.x1, dir: -1 },
  ].filter((side) => side.open);
}

// Techo de una planta cuya vecina de arriba está retranqueada: forjado con el mismo canto solo donde queda
// al aire (la de arriba ya cubre el resto) y peto en los lados abiertos. Origen en la cara superior de la planta.
export function terraceGeometry(plan, upper) {
  const L = planRect(plan);
  const U = planRect(upper);
  const t = 0.22;
  const parts = [];
  const slab = (x0, x1, z0, z1) => {
    if (x1 - x0 > 0.05 && z1 - z0 > 0.05) {
      parts.push(boxAt(x1 - x0, SLAB_T, z1 - z0, (x0 + x1) / 2, SLAB_T / 2, (z0 + z1) / 2));
    }
  };
  const mx0 = Math.max(L.x0, U.x0);
  const mx1 = Math.min(L.x1, U.x1);
  slab(L.x0, Math.min(U.x0, L.x1), L.z0, L.z1);
  slab(Math.max(U.x1, L.x0), L.x1, L.z0, L.z1);
  slab(mx0, mx1, L.z0, Math.min(U.z0, L.z1));
  slab(mx0, mx1, Math.max(U.z1, L.z0), L.z1);
  const py = SLAB_T + PARAPET_H / 2;
  for (const side of openSides(L, U)) {
    const len = side.b - side.a;
    const mid = (side.a + side.b) / 2;
    const edge = side.at + side.dir * (t / 2);
    parts.push(
      side.axis === 'z'
        ? boxAt(t, PARAPET_H, len, edge, py, mid)
        : boxAt(len, PARAPET_H, t, mid, py, edge),
    );
  }
  return mergeAll(parts);
}

// Suelo de la terraza: lámina fina sobre el forjado, con un margen para que el peto la deje ver como otro tono.
export function terraceDeckGeometry(plan, upper) {
  const L = planRect(plan);
  const U = planRect(upper);
  const m = 0.05;
  const parts = [];
  const deck = (x0, x1, z0, z1) => {
    if (x1 - x0 > 0.2 && z1 - z0 > 0.2) {
      parts.push(
        boxAt(x1 - x0 - m * 2, 0.03, z1 - z0 - m * 2, (x0 + x1) / 2, SLAB_T + 0.005, (z0 + z1) / 2),
      );
    }
  };
  const mx0 = Math.max(L.x0, U.x0);
  const mx1 = Math.min(L.x1, U.x1);
  deck(L.x0, Math.min(U.x0, L.x1), L.z0, L.z1);
  deck(Math.max(U.x1, L.x0), L.x1, L.z0, L.z1);
  deck(mx0, mx1, L.z0, Math.min(U.z0, L.z1));
  deck(mx0, mx1, Math.max(U.z1, L.z0), L.z1);
  return mergeAll(parts);
}

// Barandilla fina sobre el peto de la terraza.
export function terraceRailGeometry(plan, upper) {
  const L = planRect(plan);
  const U = planRect(upper);
  const y0 = SLAB_T + PARAPET_H;
  const parts = [];
  for (const side of openSides(L, U)) {
    const len = side.b - side.a;
    const n = Math.max(1, Math.round(len / BAY));
    const edge = side.at + side.dir * 0.11;
    for (let i = 0; i <= n; i++) {
      const c = side.a + (i * len) / n;
      parts.push(
        side.axis === 'z'
          ? boxAt(0.05, RAIL_H, 0.05, edge, y0 + RAIL_H / 2, c)
          : boxAt(0.05, RAIL_H, 0.05, c, y0 + RAIL_H / 2, edge),
      );
    }
    const mid = (side.a + side.b) / 2;
    parts.push(
      side.axis === 'z'
        ? boxAt(0.04, 0.04, len, edge, y0 + RAIL_H, mid)
        : boxAt(len, 0.04, 0.04, mid, y0 + RAIL_H, edge),
    );
  }
  return mergeAll(parts);
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
  const slab = new RoundedBoxGeometry(6.4, 0.12, 3.4, 2, 0.03);
  slab.translate(0, 3.5, z);
  add(slab, palette.bronce);
  add(boxAt(0.14, 3.4, 0.14, -2.9, 1.7, z + 1.4), palette.bronce);
  add(boxAt(0.14, 3.4, 0.14, 2.9, 1.7, z + 1.4), palette.bronce);
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
  [17.5, 8.5, 1.15],
  [-17, -8, 1.1],
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
