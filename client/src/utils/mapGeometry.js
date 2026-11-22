// Cálculos del editor de mapas: escalar coordenadas, ajustar a la rejilla y limitar las salas al plano.
// Todo va en coordenadas del plano (las del mapa de la API: `ancho`, `alto` y cada sala con x, y, w, h), nunca en
// píxeles de pantalla. Las reglas son las de `server/src/validators/mapValidator.js`: x e y ≥ 0, w y h > 0 y la sala
// dentro del plano (x + w ≤ ancho, y + h ≤ alto).

// Paso de la rejilla, en unidades del plano: al dibujar, mover y redimensionar todo cae en múltiplos de esto.
export const GRID = 10;
// Lado mínimo de una sala (más pequeña no se puede ni seleccionar bien).
export const MIN_SIZE = 20;
// Plano en blanco para una planta sin plano subido (mismo tamaño que los mapas de demo).
export const BLANK_MAP = Object.freeze({ ancho: 1000, alto: 600 });

// Tamaño del plano para una imagen: su lado mayor mide 1000 y se conserva la proporción (mínimo 200 por lado).
export function planFromImage(width, height) {
  const size = (ratio) => Math.max(200, Math.round((1000 * ratio) / GRID) * GRID);
  return width >= height
    ? { ancho: 1000, alto: size(height / width) }
    : { ancho: size(width / height), alto: 1000 };
}

export const snap = (value, grid = GRID) => Math.round(value / grid) * grid;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Punto de pantalla (clientX, clientY) → coordenadas del plano, con el <svg> del lienzo (viewBox = plano).
export function toPlanPoint(svg, clientX, clientY) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
}

// Rectángulo a partir de dos esquinas cualesquiera (se puede dibujar hacia cualquier lado), ajustado a la rejilla y
// dentro del plano.
export function rectFromPoints(a, b, plan) {
  const x1 = clamp(snap(Math.min(a.x, b.x)), 0, plan.ancho);
  const y1 = clamp(snap(Math.min(a.y, b.y)), 0, plan.alto);
  const x2 = clamp(snap(Math.max(a.x, b.x)), 0, plan.ancho);
  const y2 = clamp(snap(Math.max(a.y, b.y)), 0, plan.alto);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// ¿El rectángulo es lo bastante grande para ser una sala?
export const isBigEnough = (rect) => rect.w >= MIN_SIZE && rect.h >= MIN_SIZE;

// Sala movida (dx, dy) sin salirse del plano. No cambia su tamaño.
export function moveRect(rect, dx, dy, plan) {
  return {
    ...rect,
    x: clamp(snap(rect.x + dx), 0, plan.ancho - rect.w),
    y: clamp(snap(rect.y + dy), 0, plan.alto - rect.h),
  };
}

// Sala redimensionada desde una esquina ('nw', 'ne', 'sw', 'se') hasta el punto `to`, con la esquina contraria fija,
// tamaño mínimo y sin salirse del plano.
export function resizeRect(rect, corner, to, plan) {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.w;
  let bottom = rect.y + rect.h;
  const x = clamp(snap(to.x), 0, plan.ancho);
  const y = clamp(snap(to.y), 0, plan.alto);
  if (corner.includes('w')) left = Math.min(x, right - MIN_SIZE);
  if (corner.includes('e')) right = Math.max(x, left + MIN_SIZE);
  if (corner.includes('n')) top = Math.min(y, bottom - MIN_SIZE);
  if (corner.includes('s')) bottom = Math.max(y, top + MIN_SIZE);
  return { ...rect, x: left, y: top, w: right - left, h: bottom - top };
}

// Sala con el tamaño cambiado (dw, dh) desde su esquina inferior derecha (teclado: Mayús + flechas).
export function growRect(rect, dw, dh, plan) {
  return {
    ...rect,
    w: clamp(rect.w + dw, MIN_SIZE, plan.ancho - rect.x),
    h: clamp(rect.h + dh, MIN_SIZE, plan.alto - rect.y),
  };
}
